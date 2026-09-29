import { describe, it, expect } from 'vitest';
import {
  createPendingAction,
  getOwnedPendingAction,
  claimPendingActionForExecution,
  markRejected,
  recordExecutionOutcome,
  adminRevokePendingAction,
  fingerprintArgs,
} from './confirmations';

/**
 * A minimal in-memory fake of the ONE table this module touches
 * (ai_pending_actions), supporting insert/select/eq/update/maybeSingle —
 * enough to exercise the real state-machine logic in confirmations.ts. RLS
 * itself (ownership, the has_permission('ai_actions.manage') admin branch)
 * is Postgres policy, not something a fake client can execute — this fake
 * instead simulates its EFFECT: getOwnedPendingAction only ever finds rows
 * matching the given id (exactly what a real RLS-filtered `select` would
 * return to an authorized caller), and each test constructs a fresh db per
 * "user" to model a caller who is NOT authorized simply never being handed
 * that user's fake db instance — see the "IDOR" tests below.
 */
function makeFakeDb() {
  const store: Record<string, any> = {};
  let counter = 0;

  function chain(filters: { field: string; value: any }[], pendingUpdate: any | null) {
    const builder: any = {
      eq(field: string, value: any) {
        return chain([...filters, { field, value }], pendingUpdate);
      },
      select() {
        return builder;
      },
      async maybeSingle() {
        const matches = Object.values(store).filter((row: any) => filters.every((f) => row[f.field] === f.value));
        if (pendingUpdate) {
          if (matches.length === 0) return { data: null, error: null };
          Object.assign(matches[0], pendingUpdate);
          return { data: { ...matches[0] }, error: null };
        }
        return { data: matches[0] ?? null, error: null };
      },
      then(resolve: any, reject: any) {
        builder.maybeSingle().then(resolve, reject);
      },
    };
    return builder;
  }

  return {
    from(table: string) {
      if (table !== 'ai_pending_actions') throw new Error(`unexpected table ${table}`);
      return {
        insert(row: any) {
          const id = `pa-${++counter}`;
          const now = new Date().toISOString();
          const full = {
            id,
            status: 'pending',
            created_at: now,
            expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
            resolved_at: null,
            execution_result: null,
            ...row,
          };
          store[id] = full;
          return { select: () => ({ single: async () => ({ data: { ...full }, error: null }) }) };
        },
        select() {
          return chain([], null);
        },
        update(patch: any) {
          return chain([], patch);
        },
      };
    },
    _store: store,
  };
}

const BASE_PARAMS = {
  userId: 'user-1',
  conversationId: 'conv-1',
  toolName: 'create_reminder',
  riskLevel: 'low' as const,
  category: 'notification' as const,
  requiredPermission: 'ai_actions.use',
  args: { title: 'x', message: 'y' },
  preview: { ok: true as const, summary: 'Create a reminder', entityType: 'notification', fields: [], irreversible: false },
};

describe('createPendingAction / getOwnedPendingAction', () => {
  it('creates a pending row and can read it back by id', async () => {
    const db = makeFakeDb();
    const row = await createPendingAction(db as any, BASE_PARAMS);
    expect(row).not.toBeNull();
    expect(row!.status).toBe('pending');
    expect(row!.args_fingerprint).toBe(fingerprintArgs(BASE_PARAMS.args));

    const fetched = await getOwnedPendingAction(db as any, row!.id);
    expect(fetched?.id).toBe(row!.id);
  });

  it('returns null for a nonexistent id — never confirms existence', async () => {
    const db = makeFakeDb();
    expect(await getOwnedPendingAction(db as any, 'nope')).toBeNull();
  });
});

describe('claimPendingActionForExecution — the one-time claim', () => {
  it('claims a pending row (pending -> processing) for its owner', async () => {
    const db = makeFakeDb();
    const row = await createPendingAction(db as any, BASE_PARAMS);
    const claim = await claimPendingActionForExecution(db as any, row!.id, 'user-1');
    expect(claim.ok).toBe(true);
    if (claim.ok) expect(claim.row.status).toBe('processing');
  });

  it('a second claim attempt on the same row fails as already_resolved — this is the entire idempotency/race-safety guarantee (a "replayed confirmation" or "duplicate execution" can only ever succeed once)', async () => {
    const db = makeFakeDb();
    const row = await createPendingAction(db as any, BASE_PARAMS);
    const first = await claimPendingActionForExecution(db as any, row!.id, 'user-1');
    expect(first.ok).toBe(true);
    const second = await claimPendingActionForExecution(db as any, row!.id, 'user-1');
    expect(second).toEqual({ ok: false, reason: 'already_resolved' });
  });

  it('rejects a claim for a nonexistent confirmationId', async () => {
    const db = makeFakeDb();
    const result = await claimPendingActionForExecution(db as any, 'not-a-real-id', 'user-1');
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });

  it('IDOR: a different user cannot claim/confirm someone else\'s pending action — filtered by user_id in the same atomic update', async () => {
    const db = makeFakeDb();
    const row = await createPendingAction(db as any, BASE_PARAMS); // owned by user-1
    const claimedByAttacker = await claimPendingActionForExecution(db as any, row!.id, 'attacker-user');
    expect(claimedByAttacker.ok).toBe(false);
    // The row must remain untouched/still claimable by its real owner.
    const claimedByOwner = await claimPendingActionForExecution(db as any, row!.id, 'user-1');
    expect(claimedByOwner.ok).toBe(true);
  });

  it('an expired row cannot be claimed, even by its owner', async () => {
    const db = makeFakeDb();
    const row = await createPendingAction(db as any, BASE_PARAMS);
    db._store[row!.id].expires_at = new Date(Date.now() - 1000).toISOString();
    const result = await claimPendingActionForExecution(db as any, row!.id, 'user-1');
    expect(result).toEqual({ ok: false, reason: 'expired' });
    expect(db._store[row!.id].status).toBe('expired');
  });
});

describe('markRejected', () => {
  it('rejects a pending row for its owner', async () => {
    const db = makeFakeDb();
    const row = await createPendingAction(db as any, BASE_PARAMS);
    const result = await markRejected(db as any, row!.id, 'user-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.row.status).toBe('rejected');
  });

  it('cannot reject an already-resolved row (reject-after-reject fails)', async () => {
    const db = makeFakeDb();
    const row = await createPendingAction(db as any, BASE_PARAMS);
    await markRejected(db as any, row!.id, 'user-1');
    const second = await markRejected(db as any, row!.id, 'user-1');
    expect(second).toEqual({ ok: false, reason: 'already_resolved' });
  });

  it('cannot reject an already-claimed (processing) row — a claim in flight is not reversible by a reject race', async () => {
    const db = makeFakeDb();
    const row = await createPendingAction(db as any, BASE_PARAMS);
    await claimPendingActionForExecution(db as any, row!.id, 'user-1');
    const reject = await markRejected(db as any, row!.id, 'user-1');
    expect(reject).toEqual({ ok: false, reason: 'already_resolved' });
  });
});

describe('recordExecutionOutcome', () => {
  it('finalizes a claimed (processing) row to executed with its result', async () => {
    const db = makeFakeDb();
    const row = await createPendingAction(db as any, BASE_PARAMS);
    await claimPendingActionForExecution(db as any, row!.id, 'user-1');
    await recordExecutionOutcome(db as any, row!.id, 'user-1', true, { data: { id: 'notif-1' } });
    expect(db._store[row!.id].status).toBe('executed');
    expect(db._store[row!.id].execution_result).toEqual({ data: { id: 'notif-1' } });
  });

  it('finalizes a claimed row to failed when the handler reports failure', async () => {
    const db = makeFakeDb();
    const row = await createPendingAction(db as any, BASE_PARAMS);
    await claimPendingActionForExecution(db as any, row!.id, 'user-1');
    await recordExecutionOutcome(db as any, row!.id, 'user-1', false, { error: 'Vendor not found.' });
    expect(db._store[row!.id].status).toBe('failed');
  });

  it('never finalizes a row that was never claimed (still "pending") — the WHERE status=processing guard', async () => {
    const db = makeFakeDb();
    const row = await createPendingAction(db as any, BASE_PARAMS);
    await recordExecutionOutcome(db as any, row!.id, 'user-1', true, { data: {} });
    expect(db._store[row!.id].status).toBe('pending'); // unchanged
  });
});

describe('adminRevokePendingAction', () => {
  it('revokes another user\'s still-pending action (the admin-oversight path)', async () => {
    const db = makeFakeDb();
    const row = await createPendingAction(db as any, BASE_PARAMS); // owned by user-1
    const result = await adminRevokePendingAction(db as any, row!.id);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.row.status).toBe('rejected');
  });

  it('cannot revoke an already-resolved action', async () => {
    const db = makeFakeDb();
    const row = await createPendingAction(db as any, BASE_PARAMS);
    await markRejected(db as any, row!.id, 'user-1');
    const result = await adminRevokePendingAction(db as any, row!.id);
    expect(result).toEqual({ ok: false, reason: 'already_resolved' });
  });
});

describe('fingerprintArgs', () => {
  it('is deterministic for identical arguments', () => {
    expect(fingerprintArgs({ a: 1, b: 2 })).toBe(fingerprintArgs({ a: 1, b: 2 }));
  });
  it('differs for different arguments — this is what a changed-argument detection would key off, even though the confirm endpoint never re-accepts arguments at all', () => {
    expect(fingerprintArgs({ a: 1 })).not.toBe(fingerprintArgs({ a: 2 }));
  });
});
