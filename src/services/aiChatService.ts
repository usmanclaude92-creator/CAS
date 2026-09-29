import { getSupabaseClient } from './supabaseClient';

/**
 * Thin client for the Phase 2 AI Agent (/api/ai/*). Mirrors authService's
 * own `adminFetch` JWT pattern exactly — the caller's own Supabase session
 * token, forwarded as a Bearer header, is the only credential involved.
 * Never sends or stores a provider API key or a service-role credential;
 * this file never even sees them (they exist only server-side).
 */

export interface ToolActivityEntry {
  label: string;
}

export type ChatSendResult =
  | { success: true; conversationId: string; reply: string; toolActivity: ToolActivityEntry[] }
  | { success: false; error: string };

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

async function aiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const client = getSupabaseClient();
  const { data } = client ? await client.auth.getSession() : { data: { session: null } };
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session.');
  // Same base-URL convention as authService.adminFetch: empty for a client
  // with its own server (this app), or VITE_ADMIN_API_URL for one without
  // (e.g. the android/ build).
  const base = ((import.meta as any).env?.VITE_ADMIN_API_URL || '').replace(/\/+$/, '');
  return fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
}

export const aiChatService = {
  /** Lists the tools the current user has permission to use — mainly
   *  useful for showing an honest "no data access" state up front. */
  async listAvailableTools(): Promise<{ name: string; description: string }[]> {
    try {
      const res = await aiFetch('/api/ai/tools');
      if (!res.ok) return [];
      const body = await res.json();
      return body.success ? body.tools : [];
    } catch {
      return [];
    }
  },

  async sendMessage(message: string, conversationId?: string): Promise<ChatSendResult> {
    try {
      const res = await aiFetch('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message, conversationId }),
      });
      const body = await res.json().catch(() => null);
      if (!body || typeof body.success !== 'boolean') {
        return { success: false, error: 'Unexpected response from the server.' };
      }
      if (!body.success) {
        return { success: false, error: body.error || 'The AI Agent could not process that request.' };
      }
      return {
        success: true,
        conversationId: body.conversationId,
        reply: body.reply,
        toolActivity: body.toolActivity ?? [],
      };
    } catch (err: any) {
      return { success: false, error: err?.message === 'No active session.' ? 'Your session has expired. Please sign in again.' : 'Could not reach the AI Agent. Please check your connection and try again.' };
    }
  },

  async getConversationMessages(conversationId: string): Promise<AiChatMessage[] | null> {
    try {
      const res = await aiFetch(`/api/ai/conversations/${encodeURIComponent(conversationId)}/messages`);
      if (!res.ok) return null;
      const body = await res.json();
      return body.success ? body.messages : null;
    } catch {
      return null;
    }
  },
};
