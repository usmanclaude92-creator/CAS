import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * All access here goes through the CALLER-SCOPED client (the caller's own
 * JWT — see src/server/ai/db.ts), never service_role. RLS on
 * ai_conversations/ai_messages (auth.uid() = user_id, or the parent
 * conversation's owner) is therefore the actual enforcement: a user passing
 * another user's conversationId simply gets no row back, the same shape as
 * "conversation not found" — this file adds no separate ownership check of
 * its own, and needs none, matching the "respect the existing RLS model,
 * don't duplicate it" Phase 2 directive.
 */

export const MAX_TITLE_LENGTH = 200;
export const MAX_MESSAGE_CONTENT_LENGTH = 8000;
/** Bounds how much prior conversation is ever sent to the LLM as context —
 *  never the full history, however long the conversation has grown. */
export const MAX_CONTEXT_MESSAGES = 40;

export interface AiConversationRow {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiMessageRow {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  provider: string | null;
  model: string | null;
  created_at: string;
}

export async function createConversation(
  db: SupabaseClient,
  userId: string,
  title?: string
): Promise<AiConversationRow | null> {
  const { data, error } = await db
    .from('ai_conversations')
    .insert({ user_id: userId, title: title ? title.slice(0, MAX_TITLE_LENGTH) : null })
    .select('*')
    .single();
  if (error) return null;
  return data;
}

/** Returns null both when the conversation doesn't exist AND when it
 *  belongs to another user — RLS makes those indistinguishable, which is
 *  the correct behavior (never confirm another user's conversation exists). */
export async function getConversation(db: SupabaseClient, conversationId: string): Promise<AiConversationRow | null> {
  const { data, error } = await db.from('ai_conversations').select('*').eq('id', conversationId).maybeSingle();
  if (error) return null;
  return data;
}

export async function listRecentMessages(
  db: SupabaseClient,
  conversationId: string,
  limit: number = MAX_CONTEXT_MESSAGES
): Promise<AiMessageRow[]> {
  const { data, error } = await db
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.reverse();
}

export async function appendMessage(
  db: SupabaseClient,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  meta?: { provider?: string; model?: string }
): Promise<void> {
  await db.from('ai_messages').insert({
    conversation_id: conversationId,
    role,
    content: content.slice(0, MAX_MESSAGE_CONTENT_LENGTH),
    provider: meta?.provider ?? null,
    model: meta?.model ?? null,
  });
}

export async function touchConversation(db: SupabaseClient, conversationId: string): Promise<void> {
  await db.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
}
