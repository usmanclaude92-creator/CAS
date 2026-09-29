import { getSupabaseClient } from './supabaseClient';

/**
 * Client for the Phase 5 human-oversight surface
 * (GET/PATCH /api/ai/admin/*, all gated server-side by ai_actions.manage —
 * see src/server/ai/aiAdminRouter.ts). Same JWT-forwarding pattern as every
 * other AI service file in this directory.
 */

export interface AiActionAuditRow {
  id: string;
  executed_at: string;
  user_id: string | null;
  user_role: string | null;
  conversation_id: string | null;
  tool_name: string;
  category: string;
  risk_level: 'low' | 'medium' | 'high';
  required_permission: string;
  confirmation_status: 'not_required' | 'confirmed';
  status: string;
  affected_resource: Record<string, unknown> | null;
  error_category: string | null;
  error_message: string | null;
  duration_ms: number;
  correlation_id: string;
}

export interface AiPendingActionRow {
  id: string;
  user_id: string;
  conversation_id: string | null;
  tool_name: string;
  risk_level: 'low' | 'medium' | 'high';
  category: string;
  preview: { summary: string; entityType: string; fields: { label: string; value: string }[] };
  status: string;
  created_at: string;
  expires_at: string;
}

export interface AiRuntimeSettings {
  actionsEnabled: boolean;
  automationsEnabled: boolean;
  disabledActionTools: string[];
  updatedAt: string;
}

async function aiAdminFetch(path: string, options: RequestInit = {}): Promise<Response> {
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

export const aiAdminService = {
  async getRecentActions(limit = 50): Promise<AiActionAuditRow[]> {
    try {
      const res = await aiAdminFetch(`/api/ai/admin/actions?limit=${encodeURIComponent(String(limit))}`);
      if (!res.ok) return [];
      const body = await res.json();
      return body.success ? body.actions : [];
    } catch {
      return [];
    }
  },

  async getPendingActions(): Promise<AiPendingActionRow[]> {
    try {
      const res = await aiAdminFetch('/api/ai/admin/pending');
      if (!res.ok) return [];
      const body = await res.json();
      return body.success ? body.pending : [];
    } catch {
      return [];
    }
  },

  async revokePendingAction(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await aiAdminFetch(`/api/ai/admin/pending/${encodeURIComponent(id)}/revoke`, { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!body || typeof body.success !== 'boolean') return { success: false, error: 'Unexpected response from the server.' };
      return body.success ? { success: true } : { success: false, error: body.error };
    } catch {
      return { success: false, error: 'Could not reach the server.' };
    }
  },

  async getKillSwitch(): Promise<AiRuntimeSettings | null> {
    try {
      const res = await aiAdminFetch('/api/ai/admin/kill-switch');
      if (!res.ok) return null;
      const body = await res.json();
      return body.success ? body.settings : null;
    } catch {
      return null;
    }
  },

  async updateKillSwitch(patch: Partial<{ actionsEnabled: boolean; automationsEnabled: boolean; disabledActionTools: string[] }>): Promise<{ success: boolean; settings?: AiRuntimeSettings; error?: string }> {
    try {
      const res = await aiAdminFetch('/api/ai/admin/kill-switch', { method: 'PATCH', body: JSON.stringify(patch) });
      const body = await res.json().catch(() => null);
      if (!body || typeof body.success !== 'boolean') return { success: false, error: 'Unexpected response from the server.' };
      return body.success ? { success: true, settings: body.settings } : { success: false, error: body.error };
    } catch {
      return { success: false, error: 'Could not reach the server.' };
    }
  },
};
