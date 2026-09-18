import { isMobile } from '~/config'
import { getStoredUserToken } from '~/service/api-url'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/**
 * Auth headers for a request to the API server.
 *
 * - Browser: none — the same-origin `user_auth` cookie is sent with
 *   `credentials: 'include'`.
 * - Tauri mobile: a `Cookie` header, which the Tauri HTTP plugin can set.
 * - Tauri desktop: `X-User-Auth` — `window.fetch` forbids the `Cookie` header
 *   and macOS WKWebView won't store the cross-site `Secure` cookie, so the
 *   server auth middleware reads this header as a fallback.
 */
export function getAuthHeaders(): Record<string, string> {
  if (!isTauri) return {}

  const userToken = getStoredUserToken()
  if (!userToken) return {}

  return isMobile()
    ? { Cookie: `user_auth=${userToken}` }
    : { 'X-User-Auth': userToken }
}
