import type { AISearchConfig } from '../types'

/** What the server shows instead of a saved key (secret-store/secretMask). */
export const SAVED_KEY_MASK = '••••••••'

const sameDestination = (a: AISearchConfig, b: AISearchConfig) =>
  a.provider === b.provider && (a.baseUrl ?? '') === (b.baseUrl ?? '')

/**
 * The form after a provider or base URL change. The server never sends a
 * saved key to a new address, so a masked key is cleared there (type it
 * again) and comes back when the address returns to the saved one.
 */
export function keyForDestination(
  next: AISearchConfig,
  saved: AISearchConfig | null | undefined,
): AISearchConfig {
  if (saved?.apiKey !== SAVED_KEY_MASK) return next
  const same = sameDestination(next, saved)
  if (!same && next.apiKey === SAVED_KEY_MASK) return { ...next, apiKey: '' }
  if (same && next.apiKey === '') return { ...next, apiKey: SAVED_KEY_MASK }
  return next
}
