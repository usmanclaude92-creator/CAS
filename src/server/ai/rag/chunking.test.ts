import { describe, it, expect } from 'vitest';
import { chunkText, estimateTokens, DEFAULT_CHUNK_SIZE } from './chunking';

describe('chunkText', () => {
  it('returns no chunks for empty/whitespace-only content', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\n  ')).toEqual([]);
  });

  it('is deterministic: identical input+options always produces identical output', () => {
    const content = 'Paragraph one.\n\nParagraph two.\n\nParagraph three.'.repeat(20);
    const a = chunkText(content, { chunkSize: 300, overlap: 20 });
    const b = chunkText(content, { chunkSize: 300, overlap: 20 });
    expect(a).toEqual(b);
  });

  it('assigns strictly increasing, gapless indexes preserving order', () => {
    const content = Array.from({ length: 10 }, (_, i) => `Paragraph ${i}.`).join('\n\n');
    const chunks = chunkText(content, { chunkSize: 30, overlap: 0, minChunkSize: 0 });
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
  });

  it('never produces a chunk larger than chunkSize plus configured overlap', () => {
    const content = 'word '.repeat(2000); // one giant "paragraph"
    const chunkSize = 500;
    const overlap = 50;
    const chunks = chunkText(content, { chunkSize, overlap });
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(chunkSize + overlap + 1);
    }
  });

  it('merges an undersized trailing chunk into its predecessor rather than emitting it alone', () => {
    const content = 'A'.repeat(1000) + '\n\n' + 'tiny tail';
    const chunks = chunkText(content, { chunkSize: 1200, overlap: 0, minChunkSize: 200 });
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toContain('tiny tail');
  });

  it('does not merge a trailing chunk that is already large enough', () => {
    const content = 'A'.repeat(600) + '\n\n' + 'B'.repeat(600);
    const chunks = chunkText(content, { chunkSize: 700, overlap: 0, minChunkSize: 200 });
    expect(chunks.length).toBe(2);
  });

  it('hard-wraps a single paragraph longer than chunkSize at word boundaries, never mid-word', () => {
    const content = Array.from({ length: 100 }, (_, i) => `word${i}`).join(' ');
    const chunks = chunkText(content, { chunkSize: 50, overlap: 0, minChunkSize: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.split(' ').every((w) => /^word\d+$/.test(w))).toBe(true);
    }
  });

  it('repeats overlap characters from the previous chunk at the start of the next', () => {
    const content = 'Alpha section text here.\n\nBeta section text here.\n\nGamma section text here.';
    const chunks = chunkText(content, { chunkSize: 30, overlap: 15, minChunkSize: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    // The overlap prefix (everything before the blank-line separator that
    // starts chunk 1's own content) is a tail slice of chunk 0 — it should
    // end with chunk 0's actual last word, exactly as chunk 0 ended.
    const firstChunkWords = chunks[0].content.trim().split(/\s+/);
    const lastWordOfFirst = firstChunkWords[firstChunkWords.length - 1];
    const overlapPrefix = chunks[1].content.split('\n\n')[0];
    expect(overlapPrefix.endsWith(lastWordOfFirst)).toBe(true);
    expect(overlapPrefix.length).toBeLessThanOrEqual(15);
  });

  it('rejects invalid options rather than silently misbehaving', () => {
    expect(() => chunkText('hello', { chunkSize: 0 })).toThrow();
    expect(() => chunkText('hello', { chunkSize: 100, overlap: 100 })).toThrow();
    expect(() => chunkText('hello', { chunkSize: 100, overlap: -1 })).toThrow();
  });

  it('every chunk carries a positive token estimate proportional to its length', () => {
    const chunks = chunkText('word '.repeat(500), { chunkSize: 400, overlap: 0 });
    for (const chunk of chunks) {
      expect(chunk.tokenEstimate).toBe(estimateTokens(chunk.content));
      expect(chunk.tokenEstimate).toBeGreaterThan(0);
    }
  });

  it('uses the documented default chunk size when none is provided', () => {
    const content = 'word '.repeat(1000);
    const withDefault = chunkText(content);
    const withExplicit = chunkText(content, { chunkSize: DEFAULT_CHUNK_SIZE, overlap: 150 });
    expect(withDefault).toEqual(withExplicit);
  });
});
