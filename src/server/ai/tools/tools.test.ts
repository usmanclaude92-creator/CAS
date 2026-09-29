import { describe, it, expect, vi } from 'vitest';
import type { CallerContext } from '../../authContext';
import type { ToolExecutionContext } from '../types';
import { getProjects, getProjectSummary } from './projects';
import { getClientBalance } from './customers';
import { getVendorBalance } from './vendors';
import { getReceipts, getVendorPayments } from './financial';
import { getBankTransactions, getCashPosition } from './treasury';

/**
 * Hand-built fake query-builder chain, standing in for a Supabase
 * PostgrestFilterBuilder. Every chain method returns the same object so
 * `.from().select().eq().order().range()` (any subset, any order) all
 * resolve to the same final `{ data, error }` — and the object is itself
 * thenable so `await query` works whether or not a terminal method like
 * `.maybeSingle()` was called, matching how the real client behaves.
 */
function chain(result: { data: any; error: any }) {
  const obj: any = {
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  for (const method of ['select', 'eq', 'order', 'range', 'limit', 'ilike', 'gte', 'lte']) {
    obj[method] = vi.fn(() => obj);
  }
  obj.maybeSingle = vi.fn(() => Promise.resolve(result));
  return obj;
}

function fakeDb(byTable: Record<string, { data: any; error: any }>) {
  const chains: Record<string, ReturnType<typeof chain>> = {};
  for (const [table, result] of Object.entries(byTable)) {
    chains[table] = chain(result);
  }
  return { from: vi.fn((table: string) => chains[table] ?? chain({ data: [], error: null })), chains };
}

function caller(overrides: Partial<CallerContext> = {}): CallerContext {
  return {
    userId: 'user-1',
    email: 'test@example.com',
    profile: { status: 'active' },
    role: { code: 'viewer', permissions: [] },
    jwt: 'fake-jwt',
    ...overrides,
  };
}

function ctx(db: any, callerOverrides: Partial<CallerContext> = {}): ToolExecutionContext {
  return { caller: caller(callerOverrides), db: db as any };
}

describe('getVendorBalance — decimal-safe money summation', () => {
  it('sums fractional outstanding amounts using addMoney, not plain float addition', async () => {
    // 100.005 + 200.005 with plain JS float addition drifts off the exact
    // cent value; addMoney (integer-cent scaling) must land exactly on 300.01.
    const db = fakeDb({
      purchases: { data: [{ outstanding_amount: 100.005 }, { outstanding_amount: 200.005 }], error: null },
    });
    const result = await getVendorBalance.handler(ctx(db), { vendorId: '11111111-1111-1111-1111-111111111111' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).outstandingBalance).toBeCloseTo(300.01, 3);
    }
  });

  it('resolves by name and reports ambiguous matches instead of guessing', async () => {
    const db = fakeDb({
      vendors: {
        data: [
          { id: 'aaaaaaaa-1111-1111-1111-111111111111', name: 'Acme Steel' },
          { id: 'bbbbbbbb-1111-1111-1111-111111111111', name: 'Acme Steel Trading' },
        ],
        error: null,
      },
    });
    const result = await getVendorBalance.handler(ctx(db), { vendorName: 'Acme' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
      expect(result.metadata?.ambiguous).toBe(true);
      expect((result.metadata?.candidates as any[]).length).toBe(2);
    }
  });

  it('reports "no matching vendor found" rather than a false zero balance', async () => {
    const db = fakeDb({ vendors: { data: [], error: null } });
    const result = await getVendorBalance.handler(ctx(db), { vendorName: 'Nobody Ltd' });
    expect(result.success).toBe(false);
    if (result.success === false) expect(result.error).toMatch(/no matching vendor/i);
  });
});

describe('getClientBalance', () => {
  it('sums outstanding_amount over posted invoices only (query is pre-filtered to status=posted)', async () => {
    const db = fakeDb({
      client_invoices: { data: [{ outstanding_amount: 50.5 }, { outstanding_amount: 25.25 }], error: null },
    });
    const result = await getClientBalance.handler(ctx(db), { clientId: '11111111-1111-1111-1111-111111111111' });
    expect(result.success).toBe(true);
    if (result.success) expect((result.data as any).outstandingBalance).toBeCloseTo(75.75, 3);
  });
});

describe('getProjects — pagination reaches the query', () => {
  it('passes offset/limit straight through to .range()', async () => {
    const db = fakeDb({ projects: { data: [], error: null } });
    await getProjects.handler(ctx(db), { search: undefined, status: undefined, limit: 5, offset: 10 });
    expect(db.chains.projects.range).toHaveBeenCalledWith(10, 14);
  });
});

describe('getProjectSummary', () => {
  it('reports "not accessible" (not a crash or a false zero) when RLS filters the project out entirely', async () => {
    // A project outside the caller's assigned scope: RLS returns no row, not
    // an error — this is what a cross-project-access attempt looks like at
    // the tool-handler level without a live database to actually enforce RLS.
    const db = fakeDb({ projects: { data: null, error: null } });
    const result = await getProjectSummary.handler(ctx(db), { projectId: '11111111-1111-1111-1111-111111111111' });
    expect(result.success).toBe(false);
    if (result.success === false) expect(result.error).toMatch(/not found or not accessible/i);
  });

  it('sums only status=posted rows into invoicedToDate/costIncurred, ignoring draft/rejected rows', async () => {
    const db = fakeDb({
      projects: { data: { id: 'p1', code: 'P-1', name: 'Project One', contract_value: 1000, budget_cost: 800, status: 'active' }, error: null },
      client_invoices: {
        data: [
          { amount: 100, outstanding_amount: 40, status: 'posted' },
          { amount: 900, outstanding_amount: 900, status: 'draft' },
        ],
        error: null,
      },
      purchases: { data: [{ amount: 60, outstanding_amount: 20, status: 'posted' }], error: null },
      direct_expenses: { data: [{ amount: 15, status: 'posted' }], error: null },
    });
    const result = await getProjectSummary.handler(ctx(db), { projectId: '11111111-1111-1111-1111-111111111111' });
    expect(result.success).toBe(true);
    if (result.success) {
      const data = result.data as any;
      expect(data.invoicedToDate).toBeCloseTo(100, 3);
      expect(data.receivableOutstanding).toBeCloseTo(40, 3);
      expect(data.costIncurred).toBeCloseTo(75, 3); // 60 purchase + 15 expense, posted only
      expect(data.payableOutstanding).toBeCloseTo(20, 3);
    }
  });
});

describe('getReceipts / getVendorPayments — separate tables behind separate permissions', () => {
  it('get_receipts queries money_in', async () => {
    const db = fakeDb({ money_in: { data: [{ id: 'r1' }], error: null } });
    const result = await getReceipts.handler(ctx(db), { projectId: undefined, fromDate: undefined, toDate: undefined, limit: 20, offset: 0 });
    expect(result.success).toBe(true);
    expect(db.from).toHaveBeenCalledWith('money_in');
    expect(getReceipts.requiredPermission).toBe('money_in.view');
  });

  it('get_vendor_payments queries money_out — a distinct table/permission, never money_in', async () => {
    const db = fakeDb({ money_out: { data: [{ id: 'p1' }], error: null } });
    const result = await getVendorPayments.handler(ctx(db), { projectId: undefined, fromDate: undefined, toDate: undefined, limit: 20, offset: 0 });
    expect(result.success).toBe(true);
    expect(db.from).toHaveBeenCalledWith('money_out');
    expect(db.from).not.toHaveBeenCalledWith('money_in');
    expect(getVendorPayments.requiredPermission).toBe('money_out.view');
  });
});

describe('getBankTransactions', () => {
  it('reports the row cap in metadata and unions all three sources', async () => {
    const db = fakeDb({
      money_in: { data: [{ id: 'r1', transaction_date: '2026-01-01', amount: 10, received_from: 'X', status: 'posted' }], error: null },
      money_out: { data: [{ id: 'p1', transaction_date: '2026-01-02', amount: 5, paid_to: 'Y', status: 'posted' }], error: null },
      transfers: { data: [], error: null },
    });
    const result = await getBankTransactions.handler(ctx(db), { accountId: '11111111-1111-1111-1111-111111111111' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.metadata?.cap).toBe(500);
      const rows = result.data as any[];
      expect(rows.some((r) => r.type === 'receipt')).toBe(true);
      expect(rows.some((r) => r.type === 'payment')).toBe(true);
    }
  });
});

describe('getCashPosition — per-leg permission gating', () => {
  it('skips a leg the caller lacks permission for, but still totals the legs it can see', async () => {
    const db = fakeDb({
      bank_accounts: { data: [{ current_balance: 100 }], error: null },
      cash_accounts: { data: [{ current_balance: 50 }], error: null },
    });
    const withoutPettyCash = caller({ role: { code: 'x', permissions: ['bank_accounts.view', 'cash.view'] } });
    const result = await getCashPosition.handler({ caller: withoutPettyCash, db: db as any }, {});
    expect(result.success).toBe(true);
    if (result.success) {
      const data = result.data as any;
      expect(data.bank).toBe(100);
      expect(data.cash).toBe(50);
      expect(data.pettyCash).toBeNull();
      expect(data.total).toBeCloseTo(150, 3);
      expect(result.metadata?.skippedLegs).toContain('pettyCash');
    }
  });

  it('a caller with none of the three leg permissions gets every leg skipped and a null total, not a crash or a false 0', async () => {
    const db = fakeDb({});
    const nobody = caller({ role: { code: 'x', permissions: [] } });
    const result = await getCashPosition.handler({ caller: nobody, db: db as any }, {});
    expect(result.success).toBe(true);
    if (result.success) {
      const data = result.data as any;
      expect(data.total).toBeNull();
      expect(result.metadata?.skippedLegs).toEqual(['bank', 'cash', 'pettyCash']);
    }
  });
});
