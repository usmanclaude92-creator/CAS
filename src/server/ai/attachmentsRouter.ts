import express from 'express';
import multer from 'multer';
import { getCallerContext, log } from '../authContext';
import { createCallerScopedClient } from './db';
import { validateAttachmentUpload, MAX_DOCUMENT_BYTES, storeAttachment } from './attachments';

/**
 * POST /api/ai/attachments — uploads a temporary multimodal attachment
 * (image or PDF) for the AI Agent. Never permanent storage, never
 * auto-indexed into Phase 3's knowledge base — see
 * src/server/ai/attachments/index.ts and docs/ai/CAS-AI-PHASE-4.md. The
 * LLM never sees this endpoint or the storage bucket directly; it only
 * ever receives attachment bytes that src/server/ai/runtime.ts loaded and
 * validated via the caller-scoped client, exactly like every other piece
 * of data the model sees.
 */
export const attachmentsRouter = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 } });

async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const caller = await getCallerContext(req);
  if (!caller) {
    return res.status(401).json({ success: false, error: 'Unauthorized: invalid or missing session.' });
  }
  (req as any).caller = caller;
  next();
}

function uploadSingleFile(req: express.Request, res: express.Response, next: express.NextFunction) {
  upload.single('file')(req, res, (err: any) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, error: `File exceeds the ${Math.floor(MAX_DOCUMENT_BYTES / (1024 * 1024))}MB limit.` });
    }
    if (err) {
      log('warn', '[Attachments] multipart parse failed', { error: err?.message });
      return res.status(400).json({ success: false, error: 'Failed to process the uploaded file.' });
    }
    next();
  });
}

attachmentsRouter.post('/', requireAuth, uploadSingleFile, async (req, res) => {
  const caller = (req as any).caller;
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) {
    return res.status(400).json({ success: false, error: 'No file provided (expected multipart field "file").' });
  }

  const validation = validateAttachmentUpload(file.buffer, file.mimetype);
  if (validation.ok === false) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  let db;
  try {
    db = createCallerScopedClient(caller.jwt);
  } catch (err: any) {
    log('error', '[Attachments] failed to create caller-scoped client', { error: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }

  const result = await storeAttachment(db, caller.userId, {
    buffer: file.buffer,
    mimeType: validation.mimeType,
    kind: validation.kind,
    fileName: file.originalname || 'upload',
  });
  if (result.success === false) {
    return res.status(500).json({ success: false, error: result.error });
  }

  return res.status(201).json({
    success: true,
    attachment: {
      id: result.attachment.id,
      kind: result.attachment.kind,
      mimeType: result.attachment.mime_type,
      fileName: result.attachment.file_name,
      fileSize: result.attachment.file_size,
      expiresAt: result.attachment.expires_at,
    },
  });
});
