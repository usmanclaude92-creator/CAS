import { addMoney } from '../../../utils/formatters';
import type { ToolDefinition, ArgValidationResult } from '../types';
import { asRecord, optionalString, optionalUuid } from '../validation';
import { parsePagination } from '../pagination';

const BALANCE_ROW_CAP = 2000;

interface GetVendorsArgs {
  search?: string;
  limit: number;
  offset: number;
}

/**
 * Named get_vendors (not get_suppliers): "vendor" is the term used
 * throughout this schema/UI (table `vendors`, permission codes
 * `vendors.view`/`.create`/`.edit`, UI label "Vendors & Payables") — see
 * docs/ai/CAS-AI-TOOL-REGISTRY.md for the naming decision. "Supplier" does
 * not appear anywhere in the codebase.
 */
export const getVendors: ToolDefinition<GetVendorsArgs, unknown[]> = {
  name: 'get_vendors',
  description: 'Lists vendors. Master data with broad read access in CAS (is_active_user() RLS) — optionally filtered by name.',
  requiredPermission: 'vendors.view',
  validateArgs(raw: unknown): ArgValidationResult<GetVendorsArgs> {
    const r = asRecord(raw);
    const search = optionalString(r.search, 'search', 200);
    if (search.ok === false) return search;
    return { ok: true, args: { search: search.value, ...parsePagination(r) } };
  },
  async handler(ctx, args) {
    let query = ctx.db
      .from('vendors')
      .select('id,code,name,category,contact_person,phone,email,status')
      .order('name')
      .range(args.offset, args.offset + args.limit - 1);
    if (args.search) query = query.ilike('name', `%${args.search}%`);
    const { data, error } = await query;
    if (error) return { success: false, error: 'Failed to load vendors.' };
    return { success: true, data: data ?? [], metadata: { count: data?.length ?? 0, limit: args.limit, offset: args.offset } };
  },
};

interface GetVendorDetailsArgs {
  vendorId?: string;
  vendorName?: string;
}

export const getVendorDetails: ToolDefinition<GetVendorDetailsArgs, unknown> = {
  name: 'get_vendor_details',
  description: 'Returns one vendor\'s master-data record, looked up by id or an exact/partial name match.',
  requiredPermission: 'vendors.view',
  validateArgs(raw: unknown): ArgValidationResult<GetVendorDetailsArgs> {
    const r = asRecord(raw);
    const vendorId = optionalUuid(r.vendorId, 'vendorId');
    if (vendorId.ok === false) return vendorId;
    const vendorName = optionalString(r.vendorName, 'vendorName', 255);
    if (vendorName.ok === false) return vendorName;
    if (!vendorId.value && !vendorName.value) {
      return { ok: false, error: 'Provide either "vendorId" or "vendorName".' };
    }
    return { ok: true, args: { vendorId: vendorId.value, vendorName: vendorName.value } };
  },
  async handler(ctx, args) {
    let query = ctx.db.from('vendors').select('*').limit(5);
    query = args.vendorId ? query.eq('id', args.vendorId) : query.ilike('name', `%${args.vendorName}%`);
    const { data, error } = await query;
    if (error) return { success: false, error: 'Failed to load vendor.' };
    if (!data || data.length === 0) return { success: false, error: 'No matching vendor found.' };
    if (data.length > 1) {
      return {
        success: true,
        data: null,
        metadata: { ambiguous: true, candidates: data.map((v) => ({ id: v.id, name: v.name, code: v.code })) },
      };
    }
    return { success: true, data: data[0] };
  },
};

interface GetVendorBalanceArgs {
  vendorId?: string;
  vendorName?: string;
}

/** The tool behind the original feature request's example query:
 *  "what's the outstanding balance of Vendor xyz". */
export const getVendorBalance: ToolDefinition<GetVendorBalanceArgs, unknown> = {
  name: 'get_vendor_balance',
  description:
    'Returns a vendor\'s outstanding payable balance: SUM(outstanding_amount) over that vendor\'s posted purchases, computed with the app\'s decimal-safe addMoney() helper (never plain JS float addition).',
  requiredPermission: 'purchases.view',
  validateArgs(raw: unknown): ArgValidationResult<GetVendorBalanceArgs> {
    const r = asRecord(raw);
    const vendorId = optionalUuid(r.vendorId, 'vendorId');
    if (vendorId.ok === false) return vendorId;
    const vendorName = optionalString(r.vendorName, 'vendorName', 255);
    if (vendorName.ok === false) return vendorName;
    if (!vendorId.value && !vendorName.value) {
      return { ok: false, error: 'Provide either "vendorId" or "vendorName".' };
    }
    return { ok: true, args: { vendorId: vendorId.value, vendorName: vendorName.value } };
  },
  async handler(ctx, args) {
    let resolvedId = args.vendorId;
    let resolvedName: string | undefined;
    if (!resolvedId) {
      const { data: matches, error: matchError } = await ctx.db
        .from('vendors')
        .select('id,name')
        .ilike('name', `%${args.vendorName}%`)
        .limit(5);
      if (matchError) return { success: false, error: 'Failed to resolve vendor name.' };
      if (!matches || matches.length === 0) return { success: false, error: 'No matching vendor found.' };
      if (matches.length > 1) {
        return {
          success: true,
          data: null,
          metadata: { ambiguous: true, candidates: matches.map((v) => ({ id: v.id, name: v.name })) },
        };
      }
      resolvedId = matches[0].id;
      resolvedName = matches[0].name;
    }

    const { data: purchases, error } = await ctx.db
      .from('purchases')
      .select('outstanding_amount,status')
      .eq('vendor_id', resolvedId)
      .eq('status', 'posted')
      .limit(BALANCE_ROW_CAP);
    if (error) return { success: false, error: 'Failed to load purchases for balance calculation.' };

    const outstandingBalance = addMoney(...(purchases ?? []).map((r) => r.outstanding_amount));
    return {
      success: true,
      data: { vendorId: resolvedId, vendorName: resolvedName, outstandingBalance },
      metadata: { basis: 'posted purchases only', rowsSummed: purchases?.length ?? 0 },
    };
  },
};
