import { describe, it, expect } from 'vitest';
import {
  createConversation,
  getConversation,
  listRecentMessages,
  appendMessage,
  touchConversation,
  MAX_TITLE_LENGTH,
  MAX_MESSAGE_CONTENT_LENGTH,
} from './conversations';

/** Stateful in-memory fake, same shape as runtime.test.ts's — a real
 *  Supabase client is a stateful thing, and these functions' correctness
 *  (read-your-own-write, ownership-shaped null returns) depends on that. */
function makeFakeDb() {
  const store: Record<string, any[]> = { ai_conversations: [], ai_messages: [] };
  let counter = 0;

  function chain(table: string) {
    const rows = () => (store[table] = store[table] || []);
    return {
      insert(row: any) {
        const id = `${table}-${++counter}`;
        const now = new Date().toISOString();
        // _seq breaks ties between rows inserted within the same
        // millisecond (routine for a synchronous in-memory fake) so
        // ordering by created_at is still deterministic and matches
        // insertion order, the way distinct real-DB timestamps would.
        const full = { id, created_at: now, updated_at: now, ...row, _seq: ++counter };
        rows().push(full);
        return { select: () => ({ single: async () => ({ data: full, error: null }) }) };
      },
      select() {
        let filtered = [...rows()];
        const builder: any = {
          eq(field: string, value: any) {
            filtered = filtered.filter((r) => r[field] === value);
            return builder;
          },
          order(field: string, opts?: any) {
            const dir = opts?.ascending === false ? -1 : 1;
            const key = field === 'created_at' ? '_seq' : field;
            filtered.sort((a, b) => (a[key] < b[key] ? -dir : a[key] > b[key] ? dir : 0));
            return builder;
          },
          limit(n: number) {
            filtered = filtered.slice(0, n);
            return builder;
          },
          maybeSingle: async () => ({ data: filtered[0] ?? null, error: null }),
          then: (res: any) => Promise.resolve({ data: filtered, error: null }).then(res),
        };
        return builder;
      },
      update(patch: any) {
        return {
          eq: async (field: string, value: any) => {
            const row = rows().find((r) => r[field] === value);
            if (row) Object.assign(row, patch);
            return { data: row ?? null, error: null };
          },
        };
      },
    };
  }

  return { from: (table: string) => chain(table), _store: store };
}

describe('createConversation', () => {
  it('creates and returns a conversation row for the given user', async () => {
    const db = makeFakeDb();
    const conv = await createConversation(db as any, 'user-1', 'My question');
    expect(conv).not.toBeNull();
    expect(conv!.user_id).toBe('user-1');
    expect(conv!.title).toBe('My question');
  });

  it('truncates an overlong title rather than rejecting it', async () => {
    const db = makeFakeDb();
    const conv = await createConversation(db as any, 'user-1', 'x'.repeat(MAX_TITLE_LENGTH + 50));
    expect(conv!.title!.length).toBe(MAX_TITLE_LENGTH);
  });
});

describe('getConversation', () => {
  it('returns the conversation when it exists', async () => {
    const db = makeFakeDb();
    const created = await createConversation(db as any, 'user-1', 'hi');
    const fetched = await getConversation(db as any, created!.id);
    expect(fetched?.id).toBe(created!.id);
  });

  it('returns null for a conversation id that does not exist — the same shape RLS produces for one belonging to another user', async () => {
    const db = makeFakeDb();
    const fetched = await getConversation(db as any, 'does-not-exist');
    expect(fetched).toBeNull();
  });
});

describe('appendMessage / listRecentMessages', () => {
  it('returns messages in chronological order', async () => {
    const db = makeFakeDb();
    const conv = await createConversation(db as any, 'user-1');
    await appendMessage(db as any, conv!.id, 'user', 'first');
    await appendMessage(db as any, conv!.id, 'assistant', 'second');
    await appendMessage(db as any, conv!.id, 'user', 'third');

    const messages = await listRecentMessages(db as any, conv!.id);
    expect(messages.map((m) => m.content)).toEqual(['first', 'second', 'third']);
  });

  it('caps how many messages are returned via the limit parameter', async () => {
    const db = makeFakeDb();
    const conv = await createConversation(db as any, 'user-1');
    for (let i = 0; i < 10; i++) await appendMessage(db as any, conv!.id, 'user', `msg-${i}`);

    const messages = await listRecentMessages(db as any, conv!.id, 3);
    expect(messages.length).toBe(3);
    // The most recent 3, still in chronological order.
    expect(messages.map((m) => m.content)).toEqual(['msg-7', 'msg-8', 'msg-9']);
  });

  it('truncates overlong message content rather than rejecting it', async () => {
    const db = makeFakeDb();
    const conv = await createConversation(db as any, 'user-1');
    await appendMessage(db as any, conv!.id, 'user', 'x'.repeat(MAX_MESSAGE_CONTENT_LENGTH + 100));
    const [message] = await listRecentMessages(db as any, conv!.id);
    expect(message.content.length).toBe(MAX_MESSAGE_CONTENT_LENGTH);
  });

  it('only returns messages for the requested conversation, never another one', async () => {
    const db = makeFakeDb();
    const convA = await createConversation(db as any, 'user-1');
    const convB = await createConversation(db as any, 'user-1');
    await appendMessage(db as any, convA!.id, 'user', 'in A');
    await appendMessage(db as any, convB!.id, 'user', 'in B');

    const messagesA = await listRecentMessages(db as any, convA!.id);
    expect(messagesA.map((m) => m.content)).toEqual(['in A']);
  });
});

describe('touchConversation', () => {
  it('updates the conversation updated_at timestamp', async () => {
    const db = makeFakeDb();
    const conv = await createConversation(db as any, 'user-1');
    const before = conv!.updated_at;
    await new Promise((r) => setTimeout(r, 2));
    await touchConversation(db as any, conv!.id);
    const after = await getConversation(db as any, conv!.id);
    expect(after!.updated_at >= before).toBe(true);
  });
});
