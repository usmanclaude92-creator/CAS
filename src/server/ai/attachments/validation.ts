/**
 * Server-side multimodal attachment validation — never trusts the
 * client-declared MIME type alone (same discipline as voice/validation.ts).
 * Dependency-free: magic-byte sniffing + hand-rolled dimension/page-count
 * bounds, no image/PDF parsing library.
 */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_IMAGE_DIMENSION_PX = 8000;
export const MAX_PDF_PAGES = 50;
export const MAX_ATTACHMENTS_PER_MESSAGE = 3;

export type AttachmentKind = 'image' | 'document';

const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;
const DOCUMENT_MIME_TYPES = ['application/pdf'] as const;

function sniffImageFormat(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  const head6 = buffer.toString('ascii', 0, 6);
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'image/gif';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function sniffDocumentFormat(buffer: Buffer): string | null {
  if (buffer.length < 5) return null;
  return buffer.toString('ascii', 0, 5) === '%PDF-' ? 'application/pdf' : null;
}

function getPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function getGifDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 10) return null;
  return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
}

/** Scans JPEG markers for the first Start-Of-Frame segment (SOF0-SOF15,
 *  excluding DHT/JPG-extension markers) — the only reliable place a JPEG
 *  encodes its pixel dimensions. */
function getJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset < buffer.length - 9) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buffer[offset + 1];
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) break; // malformed — stop rather than loop forever
    offset += 2 + segmentLength;
  }
  return null;
}

function getImageDimensions(mimeType: string, buffer: Buffer): { width: number; height: number } | null {
  if (mimeType === 'image/png') return getPngDimensions(buffer);
  if (mimeType === 'image/gif') return getGifDimensions(buffer);
  if (mimeType === 'image/jpeg') return getJpegDimensions(buffer);
  // WEBP dimension parsing is not implemented (VP8/VP8L/VP8X chunk
  // variants) — still magic-byte-validated and size-capped, just not
  // dimension-checked. A documented, narrow gap, not a silent one.
  return null;
}

export type AttachmentValidationResult =
  | { ok: true; kind: AttachmentKind; mimeType: string }
  | { ok: false; error: string };

export function validateAttachmentUpload(buffer: Buffer, declaredMimeType: string): AttachmentValidationResult {
  if (!buffer || buffer.length === 0) {
    return { ok: false, error: 'File is empty.' };
  }

  if ((IMAGE_MIME_TYPES as readonly string[]).includes(declaredMimeType)) {
    if (buffer.length > MAX_IMAGE_BYTES) {
      return { ok: false, error: `Image exceeds the ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB limit.` };
    }
    const sniffed = sniffImageFormat(buffer);
    if (!sniffed) {
      return { ok: false, error: 'Could not verify the uploaded file is a supported image format.' };
    }
    if (sniffed !== declaredMimeType) {
      return { ok: false, error: 'Uploaded file content does not match its declared image type.' };
    }
    const dims = getImageDimensions(sniffed, buffer);
    if (dims && (dims.width > MAX_IMAGE_DIMENSION_PX || dims.height > MAX_IMAGE_DIMENSION_PX)) {
      return { ok: false, error: `Image dimensions (${dims.width}x${dims.height}) exceed the ${MAX_IMAGE_DIMENSION_PX}px limit.` };
    }
    return { ok: true, kind: 'image', mimeType: sniffed };
  }

  if ((DOCUMENT_MIME_TYPES as readonly string[]).includes(declaredMimeType)) {
    if (buffer.length > MAX_DOCUMENT_BYTES) {
      return { ok: false, error: `Document exceeds the ${Math.floor(MAX_DOCUMENT_BYTES / (1024 * 1024))}MB limit.` };
    }
    const sniffed = sniffDocumentFormat(buffer);
    if (!sniffed) {
      return { ok: false, error: 'Could not verify the uploaded file is a supported document format.' };
    }
    // Best-effort page-count bound (not a full PDF parse): counts
    // "/Type /Page" object markers, excluding the "/Type /Pages" parent
    // node. Enough to reject a pathologically large document up front; a
    // malformed/obfuscated PDF that evades this count is still bounded by
    // MAX_DOCUMENT_BYTES and by the model provider's own limits.
    const pageMatches = buffer.toString('latin1').match(/\/Type\s*\/Page(?!s)/g);
    const pageCount = pageMatches ? pageMatches.length : 0;
    if (pageCount > MAX_PDF_PAGES) {
      return { ok: false, error: `Document has an estimated ${pageCount} pages, exceeding the ${MAX_PDF_PAGES}-page limit.` };
    }
    return { ok: true, kind: 'document', mimeType: 'application/pdf' };
  }

  return {
    ok: false,
    error: `Unsupported file type "${declaredMimeType}". Supported: images (PNG/JPEG/GIF/WEBP) and PDF documents.`,
  };
}
