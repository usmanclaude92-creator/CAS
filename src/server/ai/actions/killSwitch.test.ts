import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ supabaseAdmin: null as any, log: vi.fn() }));

vi.mock('../../authContext', () => ({
  get supabaseAdmin() {
    return mocks.supabaseAdmin;
  },
  log: mocks.log,
}));

import { isActionToolAvailable, areAutomationsEnabled } from './killSwitch';

function fakeDb(result: { data: any; error: any } | 'throw') {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (result === 'throw') throw new Error('connection reset');
            return result;
          },
        }),
      }),
    }),
  };
}

beforeEach(() => {
  mocks.supabaseAdmin = null;
  mocks.log.mockReset();
});

describe('isActionToolAvailable', () => {
  it('is enabled when actions_enabled=true and the tool is not in the disabled list', async () => {
    const db = fakeDb({ data: { actions_enabled: true, disabled_action_tools: [] }, error: null });
    expect(await isActionToolAvailable(db as any, 'create_reminder')).toEqual({ enabled: true });
  });

  it('is disabled when the blanket switch is off, with a safe user-facing reason', async () => {
    const db = fakeDb({ data: { actions_enabled: false, disabled_action_tools: [] }, error: null });
    const result = await isActionToolAvailable(db as any, 'create_reminder');
    expect(result.enabled).toBe(false);
    expect(result.reason).toMatch(/disabled by an administrator/);
  });

  it('is disabled for a specific tool named in disabled_action_tools, even while the blanket switch is on', async () => {
    const db = fakeDb({ data: { actions_enabled: true, disabled_action_tools: ['create_direct_expense'] }, error: null });
    expect((await isActionToolAvailable(db as any, 'create_direct_expense')).enabled).toBe(false);
    expect((await isActionToolAvailable(db as any, 'create_reminder')).enabled).toBe(true);
  });

  it('fails CLOSED (disabled) when the settings row cannot be read — a DB hiccup must never silently allow actions', async () => {
    const db = fakeDb({ data: null, error: { message: 'relation does not exist' } });
    expect((await isActionToolAvailable(db as any, 'create_reminder')).enabled).toBe(false);
  });

  it('fails CLOSED when the query throws', async () => {
    const db = fakeDb('throw');
    expect((await isActionToolAvailable(db as any, 'create_reminder')).enabled).toBe(false);
  });
});

describe('areAutomationsEnabled', () => {
  it('is enabled when automations_enabled=true', async () => {
    mocks.supabaseAdmin = fakeDb({ data: { automations_enabled: true }, error: null });
    expect(await areAutomationsEnabled()).toBe(true);
  });

  it('is disabled when automations_enabled=false', async () => {
    mocks.supabaseAdmin = fakeDb({ data: { automations_enabled: false }, error: null });
    expect(await areAutomationsEnabled()).toBe(false);
  });

  it('fails closed when supabaseAdmin is unavailable (misconfigured server)', async () => {
    mocks.supabaseAdmin = null;
    expect(await areAutomationsEnabled()).toBe(false);
  });

  it('fails closed on a read error or thrown exception', async () => {
    mocks.supabaseAdmin = fakeDb({ data: null, error: { message: 'boom' } });
    expect(await areAutomationsEnabled()).toBe(false);
    mocks.supabaseAdmin = fakeDb('throw');
    expect(await areAutomationsEnabled()).toBe(false);
  });
});
