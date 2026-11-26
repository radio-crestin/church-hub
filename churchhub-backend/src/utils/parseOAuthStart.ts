import { isAllowedOrigin } from '../middleware/security'
import type { OAuthState } from '../types'

type OAuthStart = Pick<OAuthState, 'origin' | 'returnMode' | 'returnUrl'>

/** True when `url` parses and is served from exactly `origin`. */
function isOnOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin
  } catch {
    return false
  }
}

/**
 * Where an OAuth flow may hand its tokens back: the caller's allowed origin,
 * by postMessage, or a returnUrl on that same origin, by redirect. Returns
 * null for anything else, so tokens never leave the allowed origins.
 */
export function parseOAuthStart(
  query: {
    origin: string | undefined
    mode: string | undefined
    returnUrl: string | undefined
  },
  allowedOrigins: string | undefined
): OAuthStart | null {
  const { origin, returnUrl } = query
  const returnMode = query.mode ?? 'postMessage'
  if (!origin || !isAllowedOrigin(origin, allowedOrigins)) return null
  if (returnMode === 'postMessage') return { origin, returnMode }
  if (returnMode !== 'redirect') return null
  if (returnUrl !== undefined && !isOnOrigin(returnUrl, origin)) return null
  return { origin, returnMode, returnUrl }
}
