import { getSupabaseClient } from './supabaseClient';

/**
 * Client for POST /api/ai/attachments (Phase 4). Mirrors aiChatService's
 * own JWT-forwarding pattern; unlike aiChatService, this sends
 * multipart/form-data (a raw file), so it does NOT force a JSON
 * Content-Type header — the browser sets the multipart boundary itself.
 */

export interface UploadedAttachment {
  id: string;
  kind: 'image' | 'document';
  mimeType: string;
  fileName: string;
  fileSize: number;
  expiresAt: string;
}

export type UploadAttachmentResult = { success: true; attachment: UploadedAttachment } | { success: false; error: string };

async function getAuthToken(): Promise<string> {
  const client = getSupabaseClient();
  const { data } = client ? await client.auth.getSession() : { data: { session: null } };
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session.');
  return token;
}

function baseUrl(): string {
  return ((import.meta as any).env?.VITE_ADMIN_API_URL || '').replace(/\/+$/, '');
}

export const aiAttachmentService = {
  async upload(file: File): Promise<UploadAttachmentResult> {
    try {
      const token = await getAuthToken();
      const form = new FormData();
      form.append('file', file, file.name);
      const res = await fetch(`${baseUrl()}/api/ai/attachments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const body = await res.json().catch(() => null);
      if (!body || typeof body.success !== 'boolean') {
        return { success: false, error: 'Unexpected response from the server.' };
      }
      if (!body.success) {
        return { success: false, error: body.error || 'Failed to upload the attachment.' };
      }
      return { success: true, attachment: body.attachment };
    } catch (err: any) {
      return {
        success: false,
        error:
          err?.message === 'No active session.'
            ? 'Your session has expired. Please sign in again.'
            : 'Could not upload the attachment. Please check your connection and try again.',
      };
    }
  },
};
