import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import type { AttachmentKind } from './validation.js';

export { validateAttachmentUpload, MAX_IMAGE_BYTES, MAX_DOCUMENT_BYTES, MAX_ATTACHMENTS_PER_MESSAGE } from './validation.js';
export type { AttachmentKind, AttachmentValidationResult } from './validation.js';

/**
 * Temporary AI attachment storage — every call here runs through the
 * caller-scoped client passed in (never service_role). RLS on
 * ai_attachments/the `ai-attachments` Storage bucket (see the Phase 4
 * migration) is the actual ownership boundary: a caller can only ever
 * store/read/mark-used their OWN attachments — this module adds no
 * separate ownership check of its own, matching every other module in
 * src/server/ai/.
 */

const BUCKET = 'ai-attachments';
export const ATTACHMENT_TTL_HOURS = 24;

export interface AiAttachmentRow {
  id: string;
  user_id: string;
  conversation_id: string | null;
  kind: AttachmentKind;
  mime_type: string;
  file_name: string;
  file_size: number;
  storage_path: string;
  status: 'uploaded' | 'used' | 'expired';
  created_at: string;
  expires_at: string;
}

export type StoreAttachmentOutcome =
  | { success: true; attachment: AiAttachmentRow }
  | { success: false; error: string };

export async function storeAttachment(
  db: SupabaseClient,
  userId: string,
  file: { buffer: Buffer; mimeType: string; kind: AttachmentKind; fileName: string }
): Promise<StoreAttachmentOutcome> {
  const id = crypto.randomUUID();
  // Strip anything outside a safe character set, then collapse any run of
  // 2+ dots (".." would otherwise survive intact — the character class
  // allows a lone "." for extensions, but never a path-traversal-shaped
  // sequence) before using this in a storage object key.
  const safeName = (file.fileName || 'upload')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .slice(0, 100) || 'upload';
  const storagePath = `${userId}/${id}/${safeName}`;

  const { error: uploadError } = await db.storage.from(BUCKET).upload(storagePath, file.buffer, {
    contentType: file.mimeType,
    upsert: false,
  });
  if (uploadError) {
    return { success: false, error: 'Failed to store the uploaded file.' };
  }

  const { data, error: insertError } = await db
    .from('ai_attachments')
    .insert({
      id,
      user_id: userId,
      kind: file.kind,
      mime_type: file.mimeType,
      file_name: safeName,
      file_size: file.buffer.length,
      storage_path: storagePath,
      status: 'uploaded',
    })
    .select('*')
    .single();

  if (insertError || !data) {
    // Best-effort cleanup of the now-orphaned storage object — never let a
    // failed DB insert leave an untracked file sitting in the bucket.
    await db.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    return { success: false, error: 'Failed to record the uploaded file.' };
  }

  return { success: true, attachment: data as AiAttachmentRow };
}

/** Returns null for "doesn't exist", "not owned by this caller" (RLS), AND
 *  "expired" — all three are reported identically, exactly like
 *  conversations.ts's getConversation(), and for the same reason: never
 *  confirm the existence of something the caller isn't entitled to use. */
export async function getOwnedAttachment(db: SupabaseClient, attachmentId: string): Promise<AiAttachmentRow | null> {
  const { data, error } = await db.from('ai_attachments').select('*').eq('id', attachmentId).maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data as AiAttachmentRow;
}

export async function fetchAttachmentBytes(db: SupabaseClient, attachment: AiAttachmentRow): Promise<Buffer | null> {
  const { data, error } = await db.storage.from(BUCKET).download(attachment.storage_path);
  if (error || !data) return null;
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** Ties an attachment to the conversation it was first used in —
 *  permanently: runtime.ts refuses to reuse an attachment already tied to
 *  a DIFFERENT conversation, which is what keeps temporary context scoped
 *  to the conversation/request it was uploaded for (Phase 4 directive). */
export async function markAttachmentUsed(db: SupabaseClient, attachmentId: string, conversationId: string): Promise<void> {
  await db.from('ai_attachments').update({ status: 'used', conversation_id: conversationId }).eq('id', attachmentId);
}
