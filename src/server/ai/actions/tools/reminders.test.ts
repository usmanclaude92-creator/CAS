import { describe, it, expect, vi } from 'vitest';
import { createReminderTool } from './reminders';
import type { CallerContext } from '../../../authContext';

function caller(overrides: Partial<CallerContext> = {}): CallerContext {
  return { userId: 'user-1', email: 'test@example.com', profile: { status: 'active' }, role: { code: 'x', permissions: ['ai_actions.use'] }, jwt: 'fake-jwt', ...overrides };
}

describe('create_reminder — validateArgs', () => {
  it('accepts a valid title and message', () => {
    const result = createReminderTool.validateArgs({ title: 'Follow up', message: 'Call the vendor tomorrow.' });
    expect(result).toEqual({ ok: true, args: { title: 'Follow up', message: 'Call the vendor tomorrow.' } });
  });
  it('rejects a missing/empty title or message', () => {
    expect(createReminderTool.validateArgs({ title: '', message: 'x' }).ok).toBe(false);
    expect(createReminderTool.validateArgs({ title: 'x', message: '' }).ok).toBe(false);
    expect(createReminderTool.validateArgs({}).ok).toBe(false);
  });
  it('rejects an oversized title/message', () => {
    expect(createReminderTool.validateArgs({ title: 'x'.repeat(200), message: 'y' }).ok).toBe(false);
    expect(createReminderTool.validateArgs({ title: 'x', message: 'y'.repeat(2000) }).ok).toBe(false);
  });
});

describe('create_reminder — metadata (declared, not model-chosen)', () => {
  it('is low risk and never requires confirmation', () => {
    expect(createReminderTool.riskLevel).toBe('low');
    expect(createReminderTool.requiresConfirmation).toBe(false);
  });
});

describe('create_reminder — buildPreview', () => {
  it('is honest that the reminder is visible only to the calling user', async () => {
    const preview = await createReminderTool.buildPreview({ caller: caller(), db: {} as any }, { title: 'T', message: 'M' });
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.fields).toContainEqual({ label: 'Visible to', value: 'You only' });
      expect(preview.irreversible).toBe(false);
    }
  });
});

describe('create_reminder — handler', () => {
  it('inserts the reminder scoped to the CALLING user, never a broadcast or another user, even though notifications RLS would technically allow either', async () => {
    const insertSpy = vi.fn().mockReturnValue({
      select: () => ({ single: async () => ({ data: { id: 'notif-1', title: 'AI Reminder: Follow up' }, error: null }) }),
    });
    const db = { from: (table: string) => (table === 'notifications' ? { insert: insertSpy } : (() => { throw new Error('unexpected table'); })()) };

    const result = await createReminderTool.handler({ caller: caller({ userId: 'user-42' }), db: db as any }, { title: 'Follow up', message: 'Call the vendor tomorrow.' });

    expect(result.status).toBe('executed');
    const insertedPayload = insertSpy.mock.calls[0][0];
    expect(insertedPayload.user_id).toBe('user-42');
    expect(insertedPayload.title).toBe('AI Reminder: Follow up');
    expect(insertedPayload.type).toBe('system_update');
  });

  it('reports execution_failed, never throws, on a DB error', async () => {
    const db = { from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'db down' } }) }) }) }) };
    const result = await createReminderTool.handler({ caller: caller(), db: db as any }, { title: 'T', message: 'M' });
    expect(result.status).toBe('execution_failed');
    if (result.status === 'execution_failed') expect(result.error).not.toMatch(/db down/);
  });
});
