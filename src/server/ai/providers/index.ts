import type { AiProvider } from './types';
import { getAnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from './anthropic';
import { ProviderConfigError } from './errors';

export type { AiProvider, ProviderRequest, ProviderResponse, ProviderMessage, ContentBlock, ToolSchema } from './types';
export { ProviderError, ProviderConfigError, ProviderTimeoutError, ProviderInvalidResponseError } from './errors';

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
    default:
      throw new ProviderConfigError(`Unknown AI_PROVIDER "${name}".`);
  }
}

/** Informational only (persisted alongside a message for audit purposes) —
 *  never used for any security decision. */
export function getConfiguredModelName(): string {
  return process.env.AI_MODEL || DEFAULT_ANTHROPIC_MODEL;
}
