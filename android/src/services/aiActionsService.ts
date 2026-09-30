import { getSupabaseClient } from './supabaseClient';

/**
 * Client for the Phase 5 confirmation protocol
 * (POST /api/ai/actions/:id/confirm, /reject, GET /:id). Mirrors
 * aiChatService's own JWT-forwarding pattern exactly. This file has no
 * knowledge of WHAT an action does — it only ever forwards a
 * server-generated confirmationId, never re-sends arguments (there is no
 * argument field anywhere in this file), which is what makes it impossible
 * for the browser to change what a confirmed action does.
 */

export interface ActionPreviewField {
  label: string;
  value: string;
}

export interface ActionPreview {
  summary: string;
  entityType: string;
  fields: ActionPreviewField[];
  financialImpact?: { amount: number; currency: string; direction: 'debit' | 'credit' | 'none' };
  irreversible: boolean;
  warnings?: string[];
}

export interface PendingAiAction {
  confirmationId: string;
  toolName: string;
  riskLevel: 'low' | 'medium' | 'high';
  category: string;
  preview: ActionPreview;
  expiresAt: string;
}

export type ConfirmActionResult = { success: true; data: unknown } | { success: false; error: string };
export type RejectActionResult = { success: true } | { success: false; error: string };
export type GetActionResult =
  | { success: true; action: PendingAiAction & { status: string; createdAt: string } }
  | { success: false; error: string };

async function aiActionsFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const client = getSupabaseClient();
  const { data } = client ? await client.auth.getSession() : { data: { session: null } };
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session.');
  const base = ((import.meta as any).env?.VITE_ADMIN_API_URL || '').replace(/\/+$/, '');
  return fetch(`${base}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers ?? {}) },
  });
}

export const aiActionsService = {
  async confirm(confirmationId: string): Promise<ConfirmActionResult> {
    try {
      const res = await aiActionsFetch(`/api/ai/actions/${encodeURIComponent(confirmationId)}/confirm`, { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!body || typeof body.success !== 'boolean') return { success: false, error: 'Unexpected response from the server.' };
      if (!body.success) return { success: false, error: body.error || 'The action could not be completed.' };
      return { success: true, data: body.data };
    } catch (err: any) {
      return { success: false, error: err?.message === 'No active session.' ? 'Your session has expired. Please sign in again.' : 'Could not reach the server to confirm this action.' };
    }
  },

  async reject(confirmationId: string): Promise<RejectActionResult> {
    try {
      const res = await aiActionsFetch(`/api/ai/actions/${encodeURIComponent(confirmationId)}/reject`, { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!body || typeof body.success !== 'boolean') return { success: false, error: 'Unexpected response from the server.' };
      if (!body.success) return { success: false, error: body.error || 'Could not decline this action.' };
      return { success: true };
    } catch {
      return { success: false, error: 'Could not reach the server to decline this action.' };
    }
  },

  async get(confirmationId: string): Promise<GetActionResult> {
    try {
      const res = await aiActionsFetch(`/api/ai/actions/${encodeURIComponent(confirmationId)}`);
      const body = await res.json().catch(() => null);
      if (!body || typeof body.success !== 'boolean') return { success: false, error: 'Unexpected response from the server.' };
      if (!body.success) return { success: false, error: body.error || 'Action not found.' };
      return { success: true, action: body.action };
    } catch {
      return { success: false, error: 'Could not reach the server.' };
    }
  },
};
