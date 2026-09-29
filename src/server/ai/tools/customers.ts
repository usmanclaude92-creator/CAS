import { addMoney } from '../../../utils/formatters';
import type { ToolDefinition, ArgValidationResult } from '../types';
import { asRecord, optionalString, optionalUuid } from '../validation';
import { parsePagination } from '../pagination';

const BALANCE_ROW_CAP = 2000;

interface GetClientsArgs {
  search?: string;
  limit: number;
  offset: number;
}

export const getClients: ToolDefinition<GetClientsArgs, unknown[]> = {
  name: 'get_clients',
  description: 'Lists customers (clients). Master data with broad read access in CAS (is_active_user() RLS) — optionally filtered by name.',
  requiredPermission: 'customers.view',
  validateArgs(raw: unknown): ArgValidationResult<GetClientsArgs> {
    const r = asRecord(raw);
    const search = optionalString(r.search, 'search', 200);
    if (search.ok === false) return search;
    return { ok: true, args: { search: search.value, ...parsePagination(r) } };
  },
  async handler(ctx, args) {
    let query = ctx.db
      .from('customers')
      .select('id,code,name,category,contact_person,phone,email,status')
      .order('name')
      .range(args.offset, args.offset + args.limit - 1);
    if (args.search) query = query.ilike('name', `%${args.search}%`);
    const { data, error } = await query;
    if (error) return { success: false, error: 'Failed to load clients.' };
    return { success: true, data: data ?? [], metadata: { count: data?.length ?? 0, limit: args.limit, offset: args.offset } };
  },
};

interface GetClientDetailsArgs {
  clientId?: string;
  clientName?: string;
}

export const getClientDetails: ToolDefinition<GetClientDetailsArgs, unknown> = {
  name: 'get_client_details',
  description: 'Returns one customer\'s master-data record, looked up by id or an exact/partial name match.',
  requiredPermission: 'customers.view',
  validateArgs(raw: unknown): ArgValidationResult<GetClientDetailsArgs> {
    const r = asRecord(raw);
    const clientId = optionalUuid(r.clientId, 'clientId');
    if (clientId.ok === false) return clientId;
    const clientName = optionalString(r.clientName, 'clientName', 255);
    if (clientName.ok === false) return clientName;
    if (!clientId.value && !clientName.value) {
      return { ok: false, error: 'Provide either "clientId" or "clientName".' };
    }
    return { ok: true, args: { clientId: clientId.value, clientName: clientName.value } };
  },
  async handler(ctx, args) {
    let query = ctx.db.from('customers').select('*').limit(5);
    query = args.clientId ? query.eq('id', args.clientId) : query.ilike('name', `%${args.clientName}%`);
    const { data, error } = await query;
    if (error) return { success: false, error: 'Failed to load client.' };
    if (!data || data.length === 0) return { success: false, error: 'No matching client found.' };
    if (data.length > 1) {
      return {
        success: true,
        data: null,
        metadata: { ambiguous: true, candidates: data.map((c) => ({ id: c.id, name: c.name, code: c.code })) },
      };
    }
    return { success: true, data: data[0] };
  },
};

interface GetClientBalanceArgs {
  clientId?: string;
  clientName?: string;
}

export const getClientBalance: ToolDefinition<GetClientBalanceArgs, unknown> = {
  name: 'get_client_balance',
  description:
    'Returns a customer\'s outstanding receivable balance: SUM(outstanding_amount) over that client\'s posted client_invoices, computed with the app\'s decimal-safe addMoney() helper (never plain JS float addition).',
  requiredPermission: 'invoices.view',
  validateArgs(raw: unknown): ArgValidationResult<GetClientBalanceArgs> {
    const r = asRecord(raw);
    const clientId = optionalUuid(r.clientId, 'clientId');
    if (clientId.ok === false) return clientId;
    const clientName = optionalString(r.clientName, 'clientName', 255);
    if (clientName.ok === false) return clientName;
    if (!clientId.value && !clientName.value) {
      return { ok: false, error: 'Provide either "clientId" or "clientName".' };
    }
    return { ok: true, args: { clientId: clientId.value, clientName: clientName.value } };
  },
  async handler(ctx, args) {
    let resolvedId = args.clientId;
    let resolvedName: string | undefined;
    if (!resolvedId) {
      const { data: matches, error: matchError } = await ctx.db
        .from('customers')
        .select('id,name')
        .ilike('name', `%${args.clientName}%`)
        .limit(5);
      if (matchError) return { success: false, error: 'Failed to resolve client name.' };
      if (!matches || matches.length === 0) return { success: false, error: 'No matching client found.' };
      if (matches.length > 1) {
        return {
          success: true,
          data: null,
          metadata: { ambiguous: true, candidates: matches.map((c) => ({ id: c.id, name: c.name })) },
        };
      }
      resolvedId = matches[0].id;
      resolvedName = matches[0].name;
    }

    const { data: invoices, error } = await ctx.db
      .from('client_invoices')
      .select('outstanding_amount,status')
      .eq('customer_id', resolvedId)
      .eq('status', 'posted')
      .limit(BALANCE_ROW_CAP);
    if (error) return { success: false, error: 'Failed to load invoices for balance calculation.' };

    const outstandingBalance = addMoney(...(invoices ?? []).map((r) => r.outstanding_amount));
    return {
      success: true,
      data: { clientId: resolvedId, clientName: resolvedName, outstandingBalance },
      metadata: { basis: 'posted client_invoices only', rowsSummed: invoices?.length ?? 0 },
    };
  },
};
