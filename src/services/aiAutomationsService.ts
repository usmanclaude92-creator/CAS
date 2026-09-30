import { getSupabaseClient } from './supabaseClient';

/**
 * Client for personal AI automations (POST/GET/PATCH/DELETE
 * /api/ai/automations — see src/server/ai/automationsRouter.ts). Every
 * automation this creates is the fixed 'notify' kind (a scheduled personal
 * reminder) — there is no field here for anything else, matching the
 * server's own deliberately narrow scope (see
 * docs/ai/CAS-AI-PHASE-5.md's ADR).
 */

export interface AiAutomation {
  id: string;
  name: string;
  notifyTitle: string;
  notifyMessage: string;
  intervalHours: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  nextRunAt: string;
  consecutiveFailureCount: number;
}

export interface AiAutomationRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  result_summary: string | null;
  error_message: string | null;
}

async function aiAutomationsFetch(path: string, options: RequestInit = {}): Promise<Response> {
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

export const aiAutomationsService = {
  async list(): Promise<AiAutomation[]> {
    try {
      const res = await aiAutomationsFetch('/api/ai/automations');
      if (!res.ok) return [];
      const body = await res.json();
      return body.success ? body.automations : [];
    } catch {
      return [];
    }
  },

  async create(input: { name: string; notifyTitle: string; notifyMessage: string; intervalHours: number }): Promise<{ success: boolean; automation?: AiAutomation; error?: string }> {
    try {
      const res = await aiAutomationsFetch('/api/ai/automations', { method: 'POST', body: JSON.stringify(input) });
      const body = await res.json().catch(() => null);
      if (!body || typeof body.success !== 'boolean') return { success: false, error: 'Unexpected response from the server.' };
      return body.success ? { success: true, automation: body.automation } : { success: false, error: body.error };
    } catch {
      return { success: false, error: 'Could not reach the server.' };
    }
  },

  async update(id: string, patch: Partial<{ name: string; notifyTitle: string; notifyMessage: string; intervalHours: number; enabled: boolean }>): Promise<{ success: boolean; automation?: AiAutomation; error?: string }> {
    try {
      const res = await aiAutomationsFetch(`/api/ai/automations/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
      const body = await res.json().catch(() => null);
      if (!body || typeof body.success !== 'boolean') return { success: false, error: 'Unexpected response from the server.' };
      return body.success ? { success: true, automation: body.automation } : { success: false, error: body.error };
    } catch {
      return { success: false, error: 'Could not reach the server.' };
    }
  },

  async remove(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await aiAutomationsFetch(`/api/ai/automations/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const body = await res.json().catch(() => null);
      if (!body || typeof body.success !== 'boolean') return { success: false, error: 'Unexpected response from the server.' };
      return body.success ? { success: true } : { success: false, error: body.error };
    } catch {
      return { success: false, error: 'Could not reach the server.' };
    }
  },

  async getRuns(id: string): Promise<AiAutomationRun[]> {
    try {
      const res = await aiAutomationsFetch(`/api/ai/automations/${encodeURIComponent(id)}/runs`);
      if (!res.ok) return [];
      const body = await res.json();
      return body.success ? body.runs : [];
    } catch {
      return [];
    }
  },
};
