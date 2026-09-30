/**
 * Deterministic, provider-independent text chunking. A pure function of its
 * input — same content + same options always produces the same chunks in
 * the same order, which is what makes re-indexing safe to reason about
 * (see src/server/ai/rag/ingestion.ts). Provenance (which source/version a
 * chunk belongs to) is attached by the caller when persisting — this module
 * only assigns each chunk its position (`index`) within one chunking run.
 */

export interface ChunkingOptions {
  /** Target chunk size in characters (not tokens — see estimateTokens for
   *  the token approximation used only for informational sizing). */
  chunkSize?: number;
  /** Characters of the previous chunk's tail repeated at the start of the
   *  next chunk, so a fact split across a chunk boundary still has some
   *  surrounding context in whichever chunk retrieval returns. */
  overlap?: number;
  /** A trailing chunk shorter than this is merged into its predecessor
   *  instead of being emitted as a near-empty chunk on its own. */
  minChunkSize?: number;
}

export interface TextChunk {
  index: number;
  content: string;
  tokenEstimate: number;
}

export const DEFAULT_CHUNK_SIZE = 1200;
export const DEFAULT_CHUNK_OVERLAP = 150;
export const DEFAULT_MIN_CHUNK_SIZE = 200;

/** Rough, provider-agnostic token estimate (~4 chars/token in English) —
 *  used only for informational sizing/limits, never for billing accuracy. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function wrapAtWords(text: string, maxLen: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const pieces: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLen && current) {
      pieces.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) pieces.push(current);
  return pieces.length > 0 ? pieces : [text];
}

function tailWords(text: string, maxChars: number): string {
  if (maxChars <= 0 || text.length <= maxChars) return text;
  const slice = text.slice(-maxChars);
  const firstSpace = slice.indexOf(' ');
  return firstSpace === -1 ? slice : slice.slice(firstSpace + 1);
}

/**
 * Packs paragraphs (blank-line separated) greedily into chunks up to
 * `chunkSize`. A single paragraph longer than `chunkSize` is hard-wrapped
 * at word boundaries rather than left oversized. Never splits mid-word.
 */
export function chunkText(content: string, options: ChunkingOptions = {}): TextChunk[] {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap ?? DEFAULT_CHUNK_OVERLAP;
  const minChunkSize = options.minChunkSize ?? DEFAULT_MIN_CHUNK_SIZE;

  if (chunkSize <= 0) throw new Error('chunkSize must be a positive number.');
  if (overlap < 0 || overlap >= chunkSize) throw new Error('overlap must be >= 0 and less than chunkSize.');

  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const rawChunks: string[] = [];
  let current = '';
  const flush = () => {
    if (current.trim()) rawChunks.push(current.trim());
    current = '';
  };

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length <= chunkSize) {
      current = candidate;
      continue;
    }
    flush();
    if (para.length <= chunkSize) {
      current = para;
    } else {
      for (const piece of wrapAtWords(para, chunkSize)) rawChunks.push(piece);
    }
  }
  flush();

  if (rawChunks.length > 1 && rawChunks[rawChunks.length - 1].length < minChunkSize) {
    const last = rawChunks.pop() as string;
    rawChunks[rawChunks.length - 1] = `${rawChunks[rawChunks.length - 1]}\n\n${last}`;
  }

  const withOverlap = rawChunks.map((chunk, i) => {
    if (i === 0 || overlap === 0) return chunk;
    const prevTail = tailWords(rawChunks[i - 1], overlap);
    return prevTail ? `${prevTail}\n\n${chunk}` : chunk;
  });

  return withOverlap.map((chunkContent, index) => ({
    index,
    content: chunkContent,
    tokenEstimate: estimateTokens(chunkContent),
  }));
}
