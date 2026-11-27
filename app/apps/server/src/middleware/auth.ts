import { isAppWebviewOrigin, isLoopbackHostname } from './origins'
import type { AuthResult } from './types'
import { validateSystemToken } from '../service/app-sessions'
import {
  findScreenLink,
  SCREEN_LINK_PERMISSIONS,
} from '../service/screen-links'
import { deviceSessionUserId } from '../service/sync/cloud/deviceSessions'
import {
  ALL_PERMISSIONS,
  getUserById,
  getUserByToken,
  type Permission,
  updateUserLastUsed,
} from '../service/users'
import { createLogger } from '../utils/logger'
import { getRequestPeer, isLoopbackAddress } from '../utils/request-peer'

const logger = createLogger('auth')

/**
 * Read-only ("view") permissions granted to local display surfaces — the
 * projector/screen Tauri windows are separate webviews that don't carry the
 * operator's session cookie, yet they only ever READ presentation state to
 * render it. Granting view-only access from localhost keeps projection working
 * while every write/control/admin action still requires a real session.
 */
const READ_ONLY_LOCALHOST_PERMISSIONS: Permission[] = ALL_PERMISSIONS.filter(
  (p) => p.endsWith('.view'),
)

/**
 * Builds the `user_auth` Set-Cookie header value with attributes that
 * actually persist in every engine we target, as strict as each allows:
 *
 * - The Windows desktop webview (WebView2, Chromium, origin
 *   `http://tauri.localhost`) gets `None; Secure`: its UI is cross-site with
 *   this server, Chromium refuses `SameSite=None` without `Secure`, and it
 *   treats plain-http localhost as trustworthy.
 * - Every other Chromium (Chrome, Edge, CI) loads the app from this server
 *   itself, same-site, and gets `Lax`, so other sites' pages never carry it.
 * - WebKit (Safari, macOS WKWebView, Linux webkitgtk/Epiphany) gets `Lax`.
 *   Every WebKit REJECTS `Secure` over plain http — no localhost exemption —
 *   and Linux WebKit (libsoup) also rejects `SameSite=None` without `Secure`,
 *   so no `None` cookie survives there: login returned 200 yet the next
 *   /api/auth/me was signed out and the login gate spun forever. `Lax` is
 *   kept by both. It takes nothing from the desktop app: macOS WebKit sends,
 *   replaces and clears a `Lax` cookie between two origins on the same host
 *   (`localhost:*`) just as it does a `None` one, keeps neither across sites,
 *   and the desktop authenticates with its `X-User-Auth` token anyway.
 * - Remote/LAN servers serve UI and API same-origin, where `Lax` is correct
 *   and `Secure` would equally be rejected over plain http.
 */
export function buildUserAuthCookie(
  req: Request,
  token: string,
  maxAgeSeconds: number,
): string {
  const host = cookieHost(req)
  const isLocal = isLocalCookieHost(host)

  const parts = [`user_auth=${token}`, 'HttpOnly']
  if (isLocal && fromAppWebview(req) && !isNonChromiumWebKit(req)) {
    parts.push('SameSite=None', 'Secure')
  } else {
    parts.push('SameSite=Lax')
  }
  parts.push(`Max-Age=${maxAgeSeconds}`, 'Path=/')
  // Only add Domain for non-localhost (IP addresses need explicit domain)
  if (!isLocal) {
    parts.push(`Domain=${host}`)
  }
  return parts.join('; ')
}

/**
 * The session cookie again, now `Lax`, for a request it authenticated from a
 * Chromium browser on this machine outside the desktop webview: until
 * 2026-11-26 every such browser was given `SameSite=None`, which other
 * sites' pages carry along. Null for every other request.
 */
export function reissueSessionCookie(req: Request): string | null {
  const token = parseCookies(req.headers.get('Cookie') ?? '')['user_auth']
  const hadCrossSiteCookie =
    isLocalCookieHost(cookieHost(req)) && !isNonChromiumWebKit(req)
  if (!token || !hadCrossSiteCookie || fromAppWebview(req)) return null
  return buildUserAuthCookie(req, token, SESSION_COOKIE_MAX_AGE_SECONDS)
}

/** How long a session cookie lasts. */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 31536000

function cookieHost(req: Request): string {
  return req.headers.get('host')?.split(':')[0] ?? 'localhost'
}

function isLocalCookieHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1'
}

function fromAppWebview(req: Request): boolean {
  return isAppWebviewOrigin(req.headers.get('origin') ?? '')
}

/**
 * Every Chromium UA advertises both AppleWebKit and Chrome/Chromium; genuine
 * WebKit (Safari, WKWebView, webkitgtk) advertises only the former.
 */
function isNonChromiumWebKit(req: Request): boolean {
  const ua = req.headers.get('user-agent') ?? ''
  return (
    ua.includes('AppleWebKit') &&
    !ua.includes('Chrome') &&
    !ua.includes('Chromium')
  )
}

/**
 * Parses cookies from the Cookie header
 */
export function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!cookieHeader) return cookies

  for (const pair of cookieHeader.split(';')) {
    const [key, ...valueParts] = pair.trim().split('=')
    if (key) {
      cookies[key.trim()] = valueParts.join('=').trim()
    }
  }

  return cookies
}

/**
 * Whether the request comes from this machine, judged by its TCP peer address
 * (recorded by the server, see utils/request-peer.ts), never by the Host or
 * Origin header, which any client on the LAN can set to `localhost`.
 *
 * NOTE: localhost no longer grants automatic admin access. Identity always
 * comes from the `user_auth` cookie (or a system bearer token). This only
 * decides whether a *passwordless* login is allowed (the local machine is
 * physically trusted; a remote client needs a password or a pairing code
 * shown on this machine) and the read-only access of local display windows.
 */
export function isLocalhost(req: Request): boolean {
  const peer = getRequestPeer(req)
  const local = !!peer && isLoopbackAddress(peer) && addressesThisMachine(req)
  logger.debug(`Peer ${peer ?? 'unknown'} is ${local ? 'local' : 'remote'}`)
  return local
}

/**
 * Whether the request was addressed to this machine by a loopback name. A
 * local browser reaches a website's domain rebound to 127.0.0.1 from a
 * loopback peer too, but it still sends that domain as the Host.
 */
function addressesThisMachine(req: Request): boolean {
  const host = req.headers.get('host')
  if (!host) return false
  try {
    return isLoopbackHostname(new URL(`http://${host}`).hostname)
  } catch {
    return false
  }
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

/**
 * Authentication middleware — identity always comes from credentials, never
 * from the network location:
 * - System token via Authorization Bearer header → full app access (headless).
 * - `user_auth` cookie → the matching user. Super admins map to `authType:'app'`
 *   (full access); everyone else gets their own permission set.
 * - No valid credentials → 401.
 */
export async function authMiddleware(req: Request): Promise<AuthResult> {
  // 1. System token in Authorization Bearer header (headless / internal use)
  const bearerToken = extractBearerToken(req)
  if (bearerToken) {
    const isValid = await validateSystemToken(bearerToken)
    if (isValid) {
      logger.debug('System token authenticated - granting app privileges')
      return {
        response: null,
        context: { authType: 'app' },
      }
    }
    logger.info('Invalid system token provided')
  }

  // 2. user_auth — resolve the logged-in user. Normally carried by the
  //    `user_auth` cookie, but the packaged desktop app on macOS (WKWebView)
  //    can't store the cross-site `Secure` cookie over http://localhost, so the
  //    client sends the same token in an `X-User-Auth` header instead. Accept
  //    either.
  const cookieHeader = req.headers.get('Cookie') || ''
  const cookies = parseCookies(cookieHeader)
  const userToken =
    cookies['user_auth'] || req.headers.get('X-User-Auth') || undefined

  if (userToken) {
    // A screen link another device opened (T-214): what a screen reads.
    const screenLink = await findScreenLink(userToken)
    if (screenLink) {
      return {
        response: null,
        context: {
          authType: 'user',
          permissions: SCREEN_LINK_PERMISSIONS,
          screenLink,
        },
      }
    }
    // A joined phone's device session (T-174), else the user's own token.
    const deviceUserId = await deviceSessionUserId(userToken)
    const user =
      deviceUserId === null
        ? await getUserByToken(userToken)
        : getUserById(deviceUserId)
    if (user && user.isActive) {
      logger.debug(`Authenticated user: ${user.name} (id: ${user.id})`)
      updateUserLastUsed(user.id)

      // Super admin holds every permission — treat as app-level access so
      // existing `authType:'app'` bypasses and admin-only routes keep working.
      if (user.isSuperAdmin) {
        return {
          response: null,
          context: { authType: 'app', userId: user.id },
        }
      }

      return {
        response: null,
        context: {
          authType: 'user',
          userId: user.id,
          permissions: user.permissions,
        },
      }
    }
    logger.info(
      `Invalid or inactive user token: ${userToken.substring(0, 10)}...`,
    )
  }

  // 3. Local display surfaces (projector/screen webviews) have no session
  //    cookie but must be able to READ presentation state to render. Grant a
  //    view-only context to cookie-less localhost requests. Writes/control/
  //    admin still require the relevant permissions, which this never grants.
  if (isLocalhost(req)) {
    logger.debug('Cookie-less localhost - granting read-only display access')
    return {
      response: null,
      context: {
        authType: 'user',
        permissions: READ_ONLY_LOCALHOST_PERMISSIONS,
      },
    }
  }

  // 4. No valid auth
  logger.debug('Access denied: no valid authentication')
  return {
    response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }),
    context: null,
  }
}

/**
 * Admin-only middleware. Passes for system-token or super-admin sessions
 * (both resolve to `authType:'app'`); any other authenticated user gets 403.
 */
export async function adminOnlyMiddleware(req: Request): Promise<AuthResult> {
  const result = await authMiddleware(req)
  if (result.response) return result

  if (result.context?.authType === 'app') {
    return result
  }

  logger.debug('Admin access denied: not a super admin or system token')
  return {
    response: new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }),
    context: result.context,
  }
}

// Legacy exports for compatibility
export const combinedAuthMiddleware = authMiddleware
export const appOnlyAuthMiddleware = adminOnlyMiddleware
