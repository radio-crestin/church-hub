import { getExtraTrustedOrigins } from './getExtraTrustedOrigins'
import { isAppWebviewOrigin } from './isAppWebviewOrigin'
import { isLoopbackHostname } from './isLoopbackHostname'
import { isRequestOwnOrigin } from './isRequestOwnOrigin'
import { parseHttpOrigin } from './parseHttpOrigin'

/**
 * Whether a page of this origin may call the server with the user's
 * credentials: the app's webviews, a page served on this machine (any
 * port: the dev server, review builds, the test servers), the server
 * itself as the request reached it, or an origin the deployment added.
 */
export function isTrustedOrigin(origin: string, req: Request): boolean {
  if (isAppWebviewOrigin(origin)) return true
  const httpOrigin = parseHttpOrigin(origin)
  if (!httpOrigin) return false
  return (
    isLoopbackHostname(new URL(httpOrigin).hostname) ||
    isRequestOwnOrigin(httpOrigin, req) ||
    getExtraTrustedOrigins().includes(httpOrigin)
  )
}
