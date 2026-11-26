import { isTrustedOrigin } from './isTrustedOrigin'
import { createLogger } from '../../utils/logger'

const logger = createLogger('origins')

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Content types an HTML form or a CORS "simple" request can send. */
const FORM_CONTENT_TYPES = [
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
]

/** Headers no page can add to a request it sends to another origin. */
const APP_HEADERS = ['x-user-auth', 'authorization', 'x-requested-with']

function sendsFormContentType(req: Request): boolean {
  const type = (req.headers.get('content-type') ?? '').toLowerCase()
  return FORM_CONTENT_TYPES.some((form) => type.startsWith(form))
}

function sendsAppHeader(req: Request): boolean {
  return APP_HEADERS.some((name) => req.headers.has(name))
}

function refusal(req: Request, reason: string): Response {
  const { pathname } = new URL(req.url)
  logger.warning(`Refused ${req.method} ${pathname}: ${reason}`)
  return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Refuses a request a page of another site could have sent with the user's
 * credentials, before any route runs:
 * - an `Origin` the server doesn't trust (any method, the WebSocket too);
 * - a write without `Origin` that a browser marks as cross-site, or that
 *   arrives as a form (urlencoded, multipart, text/plain) without one of the
 *   app's own headers.
 * Clients that aren't browsers send no `Origin` and pass, as do the app's
 * pages, which always send their trusted origin with a write.
 */
export function refuseUntrustedRequest(req: Request): Response | null {
  const origin = req.headers.get('origin')
  if (origin !== null) {
    return isTrustedOrigin(origin, req)
      ? null
      : refusal(req, `untrusted origin ${origin}`)
  }
  if (!MUTATING_METHODS.has(req.method)) return null

  const fetchSite = req.headers.get('sec-fetch-site')
  if (fetchSite === 'cross-site' || fetchSite === 'same-site') {
    return refusal(req, `${fetchSite} request without an origin`)
  }
  if (sendsFormContentType(req) && !sendsAppHeader(req)) {
    return refusal(req, 'form request without an origin')
  }
  return null
}
