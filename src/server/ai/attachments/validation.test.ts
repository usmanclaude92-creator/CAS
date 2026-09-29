import { describe, it, expect } from 'vitest';
import { validateAttachmentUpload, MAX_IMAGE_BYTES, MAX_DOCUMENT_BYTES, MAX_IMAGE_DIMENSION_PX, MAX_PDF_PAGES } from './validation';

function pngBuffer(width = 100, height = 100, extra = 0): Buffer {
  const buf = Buffer.alloc(24 + extra);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

function jpegBuffer(width = 100, height = 100): Buffer {
  // SOI + a minimal SOF0 (0xC0) segment encoding height/width, then EOI.
  const buf = Buffer.alloc(19);
  buf[0] = 0xff;
  buf[1] = 0xd8; // SOI
  buf[2] = 0xff;
  buf[3] = 0xc0; // SOF0
  buf.writeUInt16BE(11, 4); // segment length
  buf[6] = 8; // precision
  buf.writeUInt16BE(height, 7);
  buf.writeUInt16BE(width, 9);
  buf[11] = 1; // num components
  return buf;
}

function gifBuffer(width = 100, height = 100): Buffer {
  const buf = Buffer.alloc(16);
  buf.write('GIF89a', 0, 'ascii');
  buf.writeUInt16LE(width, 6);
  buf.writeUInt16LE(height, 8);
  return buf;
}

function webpBuffer(size = 20): Buffer {
  const buf = Buffer.alloc(size);
  buf.write('RIFF', 0, 'ascii');
  buf.write('WEBP', 8, 'ascii');
  return buf;
}

function pdfBuffer(pageCount = 1): Buffer {
  const pages = Array.from({ length: pageCount }, () => '/Type /Page ').join('');
  return Buffer.from(`%PDF-1.4\n${pages}`, 'latin1');
}

describe('validateAttachmentUpload — images', () => {
  it('accepts a genuine PNG declared as image/png', () => {
    const result = validateAttachmentUpload(pngBuffer(), 'image/png');
    expect(result).toEqual({ ok: true, kind: 'image', mimeType: 'image/png' });
  });

  it('accepts a genuine JPEG declared as image/jpeg', () => {
    const result = validateAttachmentUpload(jpegBuffer(), 'image/jpeg');
    expect(result).toEqual({ ok: true, kind: 'image', mimeType: 'image/jpeg' });
  });

  it('accepts a genuine GIF declared as image/gif', () => {
    const result = validateAttachmentUpload(gifBuffer(), 'image/gif');
    expect(result).toEqual({ ok: true, kind: 'image', mimeType: 'image/gif' });
  });

  it('accepts a genuine WEBP declared as image/webp (dimensions not checked — a documented gap)', () => {
    const result = validateAttachmentUpload(webpBuffer(), 'image/webp');
    expect(result).toEqual({ ok: true, kind: 'image', mimeType: 'image/webp' });
  });

  it('never trusts a declared MIME type that contradicts the actual sniffed content', () => {
    // Genuine PNG bytes, but the client CLAIMS it's a JPEG.
    const result = validateAttachmentUpload(pngBuffer(), 'image/jpeg');
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error).toMatch(/does not match/i);
  });

  it('rejects a non-image byte stream declared as an image', () => {
    const result = validateAttachmentUpload(Buffer.from('this is definitely not an image'), 'image/png');
    expect(result.ok).toBe(false);
  });

  it('rejects an image over MAX_IMAGE_BYTES before even sniffing content', () => {
    const oversized = Buffer.concat([pngBuffer(), Buffer.alloc(MAX_IMAGE_BYTES)]);
    const result = validateAttachmentUpload(oversized, 'image/png');
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error).toMatch(/exceeds/i);
  });

  it('rejects an image whose parsed dimensions exceed MAX_IMAGE_DIMENSION_PX', () => {
    const result = validateAttachmentUpload(pngBuffer(MAX_IMAGE_DIMENSION_PX + 1, 100), 'image/png');
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error).toMatch(/dimensions/i);
  });

  it('rejects an empty buffer', () => {
    const result = validateAttachmentUpload(Buffer.alloc(0), 'image/png');
    expect(result.ok).toBe(false);
  });
});

describe('validateAttachmentUpload — documents (PDF)', () => {
  it('accepts a genuine PDF declared as application/pdf', () => {
    const result = validateAttachmentUpload(pdfBuffer(2), 'application/pdf');
    expect(result).toEqual({ ok: true, kind: 'document', mimeType: 'application/pdf' });
  });

  it('rejects a non-PDF byte stream declared as application/pdf', () => {
    const result = validateAttachmentUpload(Buffer.from('not a pdf at all'), 'application/pdf');
    expect(result.ok).toBe(false);
  });

  it('rejects a PDF over MAX_DOCUMENT_BYTES', () => {
    const oversized = Buffer.concat([pdfBuffer(1), Buffer.alloc(MAX_DOCUMENT_BYTES)]);
    const result = validateAttachmentUpload(oversized, 'application/pdf');
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error).toMatch(/exceeds/i);
  });

  it('rejects a PDF whose estimated page count exceeds MAX_PDF_PAGES — bounds an oversized document up front', () => {
    const result = validateAttachmentUpload(pdfBuffer(MAX_PDF_PAGES + 5), 'application/pdf');
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error).toMatch(/pages/i);
  });

  it("does not count the parent '/Type /Pages' node as a page", () => {
    const buf = Buffer.from('%PDF-1.4\n/Type /Pages /Type /Page ', 'latin1');
    const result = validateAttachmentUpload(buf, 'application/pdf');
    expect(result).toEqual({ ok: true, kind: 'document', mimeType: 'application/pdf' });
  });
});

describe('validateAttachmentUpload — unsupported types', () => {
  it('rejects a declared MIME type outside the image/PDF allow-list entirely', () => {
    const result = validateAttachmentUpload(Buffer.from('#!/bin/sh\necho pwned'), 'application/x-sh');
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error).toMatch(/Unsupported/);
  });

  it('rejects an executable disguised with an image MIME type — magic bytes never match', () => {
    // ELF magic bytes, declared as a PNG.
    const elf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0, 0, 0, 0, 0, 0, 0, 0]);
    const result = validateAttachmentUpload(elf, 'image/png');
    expect(result.ok).toBe(false);
  });
});
