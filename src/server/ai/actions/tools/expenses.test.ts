import { describe, it, expect, vi } from 'vitest';
import { createDirectExpenseTool } from './expenses';
import type { CallerContext } from '../../../authContext';

function caller(overrides: Partial<CallerContext> = {}): CallerContext {
  return { userId: 'user-1', email: 'test@example.com', profile: { full_name: 'Test User' }, role: { code: 'x', permissions: ['expenses.create'] }, jwt: 'fake-jwt', ...overrides };
}

const PROJECT_ID = '11111111-1111-1111-1111-111111111111';
const EXPENSE_HEAD_ID = '22222222-2222-2222-2222-222222222222';
const ACCOUNT_ID = '33333333-3333-3333-3333-333333333333';

const VALID_ARGS = {
  expenseDate: '2026-01-15',
  projectId: PROJECT_ID,
  expenseHeadId: EXPENSE_HEAD_ID,
  description: 'Site materials',
  amount: 250.5,
  paidFrom: 'bank' as const,
  accountId: ACCOUNT_ID,
};

function makeFakeDb(opts: { project?: any; expenseHead?: any; account?: any; rpcResult?: any } = {}) {
  const rpcSpy = vi.fn().mockResolvedValue(opts.rpcResult ?? { data: { id: 'exp-1', document_ref: 'EXP-AI-123', amount: '250.500' }, error: null });
  return {
    from(table: string) {
      if (table === 'projects') return { select: () => ({ eq: () => ({ maybeSingle: async () => opts.project ?? { data: { name: 'Project Alpha' }, error: null } }) }) };
      if (table === 'expense_heads') return { select: () => ({ eq: () => ({ maybeSingle: async () => opts.expenseHead ?? { data: { name: 'Materials' }, error: null } }) }) };
      if (table === 'bank_accounts') return { select: () => ({ eq: () => ({ maybeSingle: async () => opts.account ?? { data: { account_name: 'Main Bank' }, error: null } }) }) };
      throw new Error(`unexpected table ${table}`);
    },
    rpc: rpcSpy,
    _rpcSpy: rpcSpy,
  };
}

describe('create_direct_expense — validateArgs', () => {
  it('accepts well-formed arguments', () => {
    expect(createDirectExpenseTool.validateArgs(VALID_ARGS).ok).toBe(true);
  });
  it('rejects a non-positive or over-precision amount', () => {
    expect(createDirectExpenseTool.validateArgs({ ...VALID_ARGS, amount: 0 }).ok).toBe(false);
    expect(createDirectExpenseTool.validateArgs({ ...VALID_ARGS, amount: -50 }).ok).toBe(false);
    expect(createDirectExpenseTool.validateArgs({ ...VALID_ARGS, amount: 250.1234 }).ok).toBe(false);
  });
  it('rejects an invalid paidFrom enum value — never lets an arbitrary string reach the RPC/account-table lookup', () => {
    expect(createDirectExpenseTool.validateArgs({ ...VALID_ARGS, paidFrom: 'crypto_wallet' }).ok).toBe(false);
  });
  it('rejects missing required fields', () => {
    expect(createDirectExpenseTool.validateArgs({}).ok).toBe(false);
    const { description, ...missingDescription } = VALID_ARGS;
    void description;
    expect(createDirectExpenseTool.validateArgs(missingDescription).ok).toBe(false);
  });
  it('never accepts a caller-supplied VAT rate/treatment — those fields simply do not exist in the schema', () => {
    const result = createDirectExpenseTool.validateArgs({ ...VALID_ARGS, vatRate: 5, vatTreatment: 'standard' } as any);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.args).not.toHaveProperty('vatRate');
      expect(result.args).not.toHaveProperty('vatTreatment');
    }
  });
});

describe('create_direct_expense — metadata', () => {
  it('is high risk and requires confirmation — a real financial transaction', () => {
    expect(createDirectExpenseTool.riskLevel).toBe('high');
    expect(createDirectExpenseTool.requiresConfirmation).toBe(true);
  });
});

describe('create_direct_expense — buildPreview', () => {
  it('resolves real names and discloses the financial impact honestly, including that it posts immediately (not a draft)', async () => {
    const db = makeFakeDb();
    const preview = await createDirectExpenseTool.buildPreview({ caller: caller(), db: db as any }, VALID_ARGS);
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.summary).toMatch(/Project Alpha/);
      expect(preview.summary).toMatch(/Materials/);
      expect(preview.financialImpact).toEqual({ amount: 250.5, currency: 'OMR', direction: 'debit' });
      expect(preview.warnings?.some((w) => /posts immediately/i.test(w))).toBe(true);
      expect(preview.warnings?.some((w) => /reverse/i.test(w))).toBe(true);
    }
  });

  it('reports a clean not-found error when the project/expense head/account does not exist or is not accessible — never a raw DB error, never invents a name', async () => {
    const db = makeFakeDb({ project: { data: null, error: null } });
    const preview = await createDirectExpenseTool.buildPreview({ caller: caller(), db: db as any }, VALID_ARGS);
    expect(preview).toEqual({ ok: false, error: 'Project not found or not accessible.' });
  });
});

describe('create_direct_expense — handler (financial write)', () => {
  it('calls the EXISTING create_direct_expense RPC (never a raw table insert) with a decimal-safe amount', async () => {
    const db = makeFakeDb();
    const result = await createDirectExpenseTool.handler({ caller: caller(), db: db as any }, VALID_ARGS);

    expect(result.status).toBe('executed');
    expect(db._rpcSpy).toHaveBeenCalledTimes(1);
    expect(db._rpcSpy.mock.calls[0][0]).toBe('create_direct_expense');
    const payload = db._rpcSpy.mock.calls[0][1].payload;
    expect(payload.amount).toBe(250.5);
    expect(payload.netAmount).toBe(250.5);
    expect(payload.vatAmount).toBe(0);
    expect(payload.vatTreatment).toBe('out_of_scope'); // never AI-selected VAT
    expect(payload.projectId).toBe(PROJECT_ID);
  });

  it('generates a document reference when none is provided, never leaving it blank', async () => {
    const db = makeFakeDb();
    await createDirectExpenseTool.handler({ caller: caller(), db: db as any }, VALID_ARGS);
    const payload = db._rpcSpy.mock.calls[0][1].payload;
    expect(typeof payload.documentRef).toBe('string');
    expect(payload.documentRef.length).toBeGreaterThan(0);
  });

  it('uses the caller-provided documentRef when given, rather than overwriting it', async () => {
    const db = makeFakeDb();
    await createDirectExpenseTool.handler({ caller: caller(), db: db as any }, { ...VALID_ARGS, documentRef: 'MY-REF-001' });
    const payload = db._rpcSpy.mock.calls[0][1].payload;
    expect(payload.documentRef).toBe('MY-REF-001');
  });

  it('never claims success unless the RPC actually returns a row — a failed RPC call returns execution_failed, with the raw error never leaked', async () => {
    const db = makeFakeDb({ rpcResult: { data: null, error: { message: 'permission denied for function create_direct_expense (internal detail)' } } });
    const result = await createDirectExpenseTool.handler({ caller: caller(), db: db as any }, VALID_ARGS);
    expect(result.status).toBe('execution_failed');
    if (result.status === 'execution_failed') expect(result.error).not.toMatch(/internal detail|permission denied for function/);
  });

  it('re-validates entity existence at write time (not just at preview time) and fails cleanly if something vanished in between', async () => {
    const db = makeFakeDb({ account: { data: null, error: null } });
    const result = await createDirectExpenseTool.handler({ caller: caller(), db: db as any }, VALID_ARGS);
    expect(result.status).toBe('validation_failed');
    expect(db._rpcSpy).not.toHaveBeenCalled();
  });
});
