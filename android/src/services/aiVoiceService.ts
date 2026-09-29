import { getSupabaseClient } from './supabaseClient';

/**
 * Client for POST /api/ai/voice/transcribe and POST /api/ai/voice/synthesize
 * (Phase 4). Same JWT-forwarding pattern as aiChatService/aiAttachmentService.
 * transcribe() returns a plain transcript string — the caller (the chat
 * modal) then sends it to aiChatService.sendMessage() exactly like typed
 * text; this file has no knowledge of the AI runtime or tool registry.
 */

export type TranscribeResult = { success: true; transcript: string } | { success: false; error: string };
export type SynthesizeResult = { success: true; audioUrl: string } | { success: false; error: string };

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

export const aiVoiceService = {
  async transcribe(audioBlob: Blob, language?: string): Promise<TranscribeResult> {
    try {
      const token = await getAuthToken();
      const form = new FormData();
      form.append('audio', audioBlob, 'recording.webm');
      if (language) form.append('language', language);
      const res = await fetch(`${baseUrl()}/api/ai/voice/transcribe`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const body = await res.json().catch(() => null);
      if (!body || typeof body.success !== 'boolean') {
        return { success: false, error: 'Unexpected response from the server.' };
      }
      if (!body.success) {
        return { success: false, error: body.error || 'Could not transcribe the recording.' };
      }
      return { success: true, transcript: body.transcript };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message === 'No active session.' ? 'Your session has expired. Please sign in again.' : 'Could not reach the transcription service.',
      };
    }
  },

  async synthesize(text: string, voice?: string): Promise<SynthesizeResult> {
    try {
      const token = await getAuthToken();
      const res = await fetch(`${baseUrl()}/api/ai/voice/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text, voice }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return { success: false, error: body?.error || 'Could not generate speech for this response.' };
      }
      const blob = await res.blob();
      return { success: true, audioUrl: URL.createObjectURL(blob) };
    } catch {
      return { success: false, error: 'Could not reach the speech service.' };
    }
  },
};
