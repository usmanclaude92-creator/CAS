import { getSupabaseClient } from './supabaseClient';

/**
 * Client for the Knowledge Base admin surface (GET/POST/PUT /api/ai/knowledge/*,
 * all gated server-side by knowledge.manage — see
 * src/server/ai/knowledgeAdminRouter.ts). Same JWT-forwarding pattern as
 * every other AI service file in this directory.
 */

export type KnowledgeSourceType = 'markdown' | 'text' | 'html';
export type KnowledgeVisibility = 'internal' | 'restricted';
export type KnowledgeStatus = 'draft' | 'published' | 'archived';
export type KnowledgeIndexingStatus = 'pending' | 'indexing' | 'indexed' | 'failed';

export interface KnowledgeSourceRow {
  id: string;
  title: string;
  description: string | null;
  source_type: KnowledgeSourceType;
  visibility: KnowledgeVisibility;
  status: KnowledgeStatus;
  version: number;
  indexing_status: KnowledgeIndexingStatus;
  indexing_error: string | null;
  created_at: string;
  updated_at: string;
  indexed_at: string | null;
}

export interface KnowledgeSourceDetail extends KnowledgeSourceRow {
  content: string;
  created_by: string | null;
}

export interface KnowledgeSourcePayload {
  title: string;
  description?: string;
  sourceType: KnowledgeSourceType;
  visibility: KnowledgeVisibility;
  content: string;
}

// A single shape (never a two-branch discriminated union) — this project's
// tsconfig doesn't enable `strict` (so strictNullChecks is off), under
// which TS's control-flow narrowing on a literal success:true/false
// discriminant is unreliable. Every other service in this directory
// (aiAdminService.ts included) already uses this same safe shape.
export interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function knowledgeFetch(path: string, options: RequestInit = {}): Promise<Response> {
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

async function parseResult<T>(res: Response): Promise<Result<T>> {
  const body = await res.json().catch(() => null);
  if (!body || typeof body.success !== 'boolean') return { success: false, error: 'Unexpected response from the server.' };
  if (!body.success) return { success: false, error: body.error || 'Request failed.' };
  return { success: true, data: body.data ?? body };
}

export const knowledgeAdminService = {
  async list(): Promise<Result<KnowledgeSourceRow[]>> {
    try {
      const res = await knowledgeFetch('/api/ai/knowledge');
      return parseResult<KnowledgeSourceRow[]>(res);
    } catch {
      return { success: false, error: 'Could not reach the server.' };
    }
  },

  async get(id: string): Promise<Result<KnowledgeSourceDetail>> {
    try {
      const res = await knowledgeFetch(`/api/ai/knowledge/${encodeURIComponent(id)}`);
      return parseResult<KnowledgeSourceDetail>(res);
    } catch {
      return { success: false, error: 'Could not reach the server.' };
    }
  },

  async create(payload: KnowledgeSourcePayload): Promise<Result<KnowledgeSourceDetail>> {
    try {
      const res = await knowledgeFetch('/api/ai/knowledge', { method: 'POST', body: JSON.stringify(payload) });
      return parseResult<KnowledgeSourceDetail>(res);
    } catch {
      return { success: false, error: 'Could not reach the server.' };
    }
  },

  async update(id: string, payload: Partial<KnowledgeSourcePayload>): Promise<Result<KnowledgeSourceDetail>> {
    try {
      const res = await knowledgeFetch(`/api/ai/knowledge/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
      return parseResult<KnowledgeSourceDetail>(res);
    } catch {
      return { success: false, error: 'Could not reach the server.' };
    }
  },

  async publish(id: string): Promise<Result<KnowledgeSourceDetail>> {
    try {
      const res = await knowledgeFetch(`/api/ai/knowledge/${encodeURIComponent(id)}/publish`, { method: 'POST' });
      return parseResult<KnowledgeSourceDetail>(res);
    } catch {
      return { success: false, error: 'Could not reach the server.' };
    }
  },

  async archive(id: string): Promise<Result<KnowledgeSourceDetail>> {
    try {
      const res = await knowledgeFetch(`/api/ai/knowledge/${encodeURIComponent(id)}/archive`, { method: 'POST' });
      return parseResult<KnowledgeSourceDetail>(res);
    } catch {
      return { success: false, error: 'Could not reach the server.' };
    }
  },

  async reindex(id: string): Promise<Result<{ chunkCount: number }>> {
    try {
      const res = await knowledgeFetch(`/api/ai/knowledge/${encodeURIComponent(id)}/reindex`, { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!body || typeof body.success !== 'boolean') return { success: false, error: 'Unexpected response from the server.' };
      if (!body.success) return { success: false, error: body.error || 'Reindex failed.' };
      return { success: true, data: { chunkCount: body.chunkCount ?? 0 } };
    } catch {
      return { success: false, error: 'Could not reach the server.' };
    }
  },
};
