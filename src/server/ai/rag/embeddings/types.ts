/**
 * Provider-agnostic embedding abstraction — mirrors the LLM provider
 * pattern in src/server/ai/providers/types.ts exactly, for the same
 * reason: src/server/ai/rag/ingestion.ts and retrieval.ts depend only on
 * this interface, so adding a second embedding vendor is one new file, not
 * a change to ingestion, retrieval, or any security logic.
 */

export type EmbeddingInputType = 'document' | 'query';

export interface EmbedOptions {
  timeoutMs?: number;
  /** Some providers (Voyage included) produce measurably better retrieval
   *  when told whether a text is being embedded to be STORED ('document')
   *  or to be SEARCHED WITH ('query'). Defaults to 'document'. */
  inputType?: EmbeddingInputType;
}

export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  /** Fixed vector width this provider/model produces — must match the
   *  `vector(N)` column width in the knowledge_chunks migration. */
  readonly dimensions: number;
  embed(text: string, opts?: EmbedOptions): Promise<number[]>;
  embedBatch(texts: string[], opts?: EmbedOptions): Promise<number[][]>;
}
