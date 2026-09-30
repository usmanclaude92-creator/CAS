import type { AiProvider } from './types.js';
import { getAnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from './anthropic.js';
import { getGeminiProvider, DEFAULT_GEMINI_MODEL } from './gemini.js';
import { ProviderConfigError } from './errors.js';

export type { AiProvider, ProviderRequest, ProviderResponse, ProviderMessage, ContentBlock, ToolSchema } from './types.js';
export { ProviderError, ProviderConfigError, ProviderTimeoutError, ProviderInvalidResponseError } from './errors.js';

const DEFAULT_MODEL_BY_PROVIDER: Record<string, string> = {
  anthropic: DEFAULT_ANTHROPIC_MODEL,
  gemini: DEFAULT_GEMINI_MODEL,
};

/**
 * Picks the configured provider by AI_PROVIDER (default "anthropic"). Called
 * per-request from runtime.ts, never at module-evaluation time — an
 * unconfigured/unknown provider throws ProviderConfigError, which the
 * runtime turns into a safe "AI Agent is not configured" response rather
 * than crashing the request or, worse, a fake/hard-coded reply.
 */
export function getProvider(): AiProvider {
  const name = (process.env.AI_PROVIDER || 'anthropic').trim().toLowerCase();
  switch (name) {
    case 'anthropic':
      return getAnthropicProvider();
    case 'gemini':
      return getGeminiProvider();
    default:
      throw new ProviderConfigError(`Unknown AI_PROVIDER "${name}".`);
  }
}

/** Informational only (persisted alongside a message for audit purposes) —
 *  never used for any security decision. */
export function getConfiguredModelName(): string {
  const provider = (process.env.AI_PROVIDER || 'anthropic').trim().toLowerCase();
  return process.env.AI_MODEL || DEFAULT_MODEL_BY_PROVIDER[provider] || DEFAULT_ANTHROPIC_MODEL;
}
