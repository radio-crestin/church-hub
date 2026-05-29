import type { AuthResult } from './types'
import { validateSystemToken } from '../service/app-sessions'
import {
  ALL_PERMISSIONS,
  getUserByToken,
  type Permission,
  updateUserLastUsed,
} from '../service/users'
import { createLogger } from '../utils/logger'

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
 * Check if request is from localhost
 * Uses Host header as primary check since it's always present for HTTP requests
 *
 * NOTE: localhost no longer grants automatic admin access. Identity always
 * comes from the `user_auth` cookie (or a system bearer token). This helper is
 * only used to decide whether a *passwordless* login is allowed — the local
 * machine is considered physically trusted, so a passwordless owner can sign
 * in without friction, while remote clients must always supply a password.
 */
export function isLocalhost(req: Request): boolean {
  // Helper to check if a hostname/IP is localhost
  const isLocalhostValue = (value: string): boolean => {
    const normalized = value.toLowerCase().trim()
    return (
      normalized === 'localhost' ||
      normalized === '127.0.0.1' ||
      normalized === '::1' ||
      normalized === '0.0.0.0' ||
      normalized.startsWith('127.') ||
      // Tauri webview uses tauri.localhost as its origin
      normalized === 'tauri.localhost' ||
      normalized.endsWith('.localhost')
    )
  }

  const host = req.headers.get('Host')
  const origin = req.headers.get('Origin')

  logger.debug(`Auth check — Host: "${host}", Origin: "${origin}"`)


  // Primary check: Host header (always present for HTTP/1.1+ requests)
  if (host) {
    const hostname = host.split(':')[0]
    if (isLocalhostValue(hostname)) {
      logger.debug(`Localhost detected via Host: ${host}`)
      return true
    }
  }

  // Secondary check: Origin header (for CORS requests from localhost)
  if (origin) {
    try {
      const originUrl = new URL(origin)
      if (isLocalhostValue(originUrl.hostname)) {
        logger.debug(`Localhost detected via Origin: ${origin}`)
        return true
      }
    } catch {
      // Invalid origin URL, continue checking
    }
  }

  // If no Host header (unusual), default to allowing
  if (!host) {
    logger.debug('No Host header, defaulting to localhost')
    return true
  }

  // Host header exists but doesn't match localhost
  logger.debug(`Remote access from Host: ${host}`)
  return false
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
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

  // 2. user_auth cookie — resolve the logged-in user
  const cookieHeader = req.headers.get('Cookie') || ''
  const cookies = parseCookies(cookieHeader)
  const userToken = cookies['user_auth']

  if (userToken) {
    const user = await getUserByToken(userToken)
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
