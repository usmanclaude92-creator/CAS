import express from 'express';
import multer from 'multer';
import { getCallerContext, log } from '../authContext.js';
import { getSttProvider, SttConfigError, SttTimeoutError, SttError } from './voice/stt/index.js';
import { getTtsProvider, TtsConfigError, TtsTimeoutError, TtsError } from './voice/tts/index.js';
import { validateAudioUpload, MAX_AUDIO_BYTES } from './voice/validation.js';
import { asRecord } from './validation.js';

/**
 * Voice endpoints. Deliberately NOT a new authorization path: /transcribe
 * returns a plain transcript string and nothing else — the client sends
 * that transcript to the existing POST /api/ai/chat exactly like typed
 * text (see docs/ai/CAS-AI-PHASE-4.md). Nothing here calls into the AI
 * runtime, the tool registry, or the database — voice is purely an
 * input/output modality conversion (audio <-> text), not a second way to
 * reach CAS data.
 */
export const voiceRouter = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_AUDIO_BYTES, files: 1 } });

const MAX_TTS_TEXT_LENGTH = 2000;
const PROVIDER_TIMEOUT_MS = 30_000;

async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const caller = await getCallerContext(req);
  if (!caller) {
    return res.status(401).json({ success: false, error: 'Unauthorized: invalid or missing session.' });
  }
  (req as any).caller = caller;
  next();
}

function uploadSingleAudio(req: express.Request, res: express.Response, next: express.NextFunction) {
  upload.single('audio')(req, res, (err: any) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, error: `Audio file exceeds the ${Math.floor(MAX_AUDIO_BYTES / (1024 * 1024))}MB limit.` });
    }
    if (err) {
      log('warn', '[Voice] multipart parse failed', { error: err?.message });
      return res.status(400).json({ success: false, error: 'Failed to process the uploaded audio.' });
    }
    next();
  });
}

/**
 * POST /api/ai/voice/transcribe — multipart form field "audio", optional
 * "language" (ISO 639-1). Server-validates size/MIME/magic-bytes before
 * ever calling the STT provider (see voice/validation.ts) — the client's
 * declared Content-Type is never trusted alone.
 */
voiceRouter.post('/transcribe', requireAuth, uploadSingleAudio, async (req, res) => {
  const caller = (req as any).caller;
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) {
    return res.status(400).json({ success: false, error: 'No audio file provided (expected multipart field "audio").' });
  }

  const validation = validateAudioUpload(file.buffer, file.mimetype);
  if (validation.ok === false) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  let provider;
  try {
    provider = getSttProvider();
  } catch (err) {
    if (err instanceof SttConfigError) {
      log('error', '[Voice] STT not configured', { error: err.message });
      return res.status(503).json({ success: false, error: 'Voice transcription is not currently configured.' });
    }
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }

  const body = asRecord(req.body);
  const language = typeof body.language === 'string' && body.language.length <= 10 ? body.language : undefined;

  const startedAt = Date.now();
  let result;
  try {
    result = await provider.transcribe(file.buffer, validation.mimeType, { language, timeoutMs: PROVIDER_TIMEOUT_MS });
  } catch (err) {
    if (err instanceof SttTimeoutError) {
      return res.status(504).json({ success: false, error: 'Transcription took too long. Please try again.' });
    }
    if (err instanceof SttError) {
      log('error', '[Voice] STT request failed', { category: err.category, message: err.message });
      return res.status(502).json({ success: false, error: 'Transcription failed. Please try again.' });
    }
    log('error', '[Voice] unexpected STT error', { error: (err as any)?.message });
    return res.status(500).json({ success: false, error: 'Internal error processing audio.' });
  }

  const transcript = result.text.trim();
  // Metadata only — never the audio bytes or the transcript content itself
  // (the transcript may contain business-sensitive phrasing; the audit
  // trail for WHAT was asked already exists once this transcript reaches
  // POST /api/ai/chat and is persisted as an ordinary user message there).
  log('info', '[Voice] transcription completed', {
    userId: caller.userId,
    durationMs: Date.now() - startedAt,
    audioBytes: file.buffer.length,
    transcriptLength: transcript.length,
  });

  return res.status(200).json({ success: true, transcript });
});

/**
 * POST /api/ai/voice/synthesize — { text }. Intended for the final,
 * already-bounded assistant reply text only — never a system prompt, tool
 * result, or any other internal content (that discipline is the caller's
 * responsibility; this endpoint bounds length defensively regardless).
 */
voiceRouter.post('/synthesize', requireAuth, async (req, res) => {
  const body = asRecord(req.body);
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return res.status(400).json({ success: false, error: '"text" is required.' });
  }
  if (text.length > MAX_TTS_TEXT_LENGTH) {
    return res.status(400).json({ success: false, error: `"text" exceeds the ${MAX_TTS_TEXT_LENGTH}-character limit.` });
  }

  let provider;
  try {
    provider = getTtsProvider();
  } catch (err) {
    if (err instanceof TtsConfigError) {
      log('error', '[Voice] TTS not configured', { error: err.message });
      return res.status(503).json({ success: false, error: 'Voice responses are not currently configured.' });
    }
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }

  const voice = typeof body.voice === 'string' && body.voice.length <= 30 ? body.voice : undefined;

  let result;
  try {
    result = await provider.synthesize(text, { voice, timeoutMs: PROVIDER_TIMEOUT_MS });
  } catch (err) {
    if (err instanceof TtsTimeoutError) {
      return res.status(504).json({ success: false, error: 'Speech generation took too long.' });
    }
    if (err instanceof TtsError) {
      log('error', '[Voice] TTS request failed', { category: err.category, message: err.message });
      return res.status(502).json({ success: false, error: 'Speech generation failed.' });
    }
    log('error', '[Voice] unexpected TTS error', { error: (err as any)?.message });
    return res.status(500).json({ success: false, error: 'Internal error generating speech.' });
  }

  res.setHeader('Content-Type', result.mimeType);
  res.setHeader('Content-Length', String(result.audio.length));
  return res.status(200).send(result.audio);
});
