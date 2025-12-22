import type { AuthResult } from './types'
import { validateSystemToken } from '../service/app-sessions'
import { getUserByToken, updateUserLastUsed } from '../service/users'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: Logging
  console.log(`[auth:${level}] ${message}`)
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
 * Check if request is from localhost
 * Uses Host header as primary check since it's always present for HTTP requests
 */
function isLocalhost(req: Request): boolean {
  // Helper to check if a hostname/IP is localhost
  const isLocalhostValue = (value: string): boolean => {
    const normalized = value.toLowerCase().trim()
    return (
      normalized === 'localhost' ||
      normalized === '127.0.0.1' ||
      normalized === '::1' ||
      normalized.startsWith('127.')
    )
  }

  const host = req.headers.get('Host')
  const origin = req.headers.get('Origin')

  // Primary check: Host header (always present for HTTP/1.1+ requests)
  if (host) {
    const hostname = host.split(':')[0]
    if (isLocalhostValue(hostname)) {
      log('debug', `Localhost detected via Host: ${host}`)
      return true
    }
  }

  // Secondary check: Origin header (for CORS requests from localhost)
  if (origin) {
    try {
      const originUrl = new URL(origin)
      if (isLocalhostValue(originUrl.hostname)) {
        log('debug', `Localhost detected via Origin: ${origin}`)
        return true
      }
    } catch {
      // Invalid origin URL, continue checking
    }
  }

  // If no Host header (unusual), default to allowing
  if (!host) {
    log('debug', 'No Host header, defaulting to localhost')
    return true
  }

  // Host header exists but doesn't match localhost
  log('debug', `Remote access from Host: ${host}`)
  return false
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}

/**
 * Simple authentication middleware
 * - Localhost requests get full admin access
 * - System token via Authorization Bearer header gets admin access
 * - Remote requests need user_auth cookie token
 */
export async function authMiddleware(req: Request): Promise<AuthResult> {
  // 1. Check if localhost - grant full admin access
  if (isLocalhost(req)) {
    log('debug', 'Localhost access - granting admin privileges')
    return {
      response: null,
      context: { authType: 'app' },
    }
  }

  // 2. Check for system token in Authorization Bearer header
  const bearerToken = extractBearerToken(req)
  if (bearerToken) {
    const isValid = await validateSystemToken(bearerToken)
    if (isValid) {
      log('info', 'System token authenticated - granting app privileges')
      return {
        response: null,
        context: { authType: 'app' },
      }
    }
    log('info', 'Invalid system token provided')
  }

  // 3. Remote access - check user_auth cookie
  const cookieHeader = req.headers.get('Cookie') || ''
  const cookies = parseCookies(cookieHeader)
  const userToken = cookies['user_auth']

  log(
    'info',
    `Remote request - Cookie header: ${cookieHeader ? 'present' : 'missing'}`,
  )
  log(
    'info',
    `Remote request - user_auth token: ${userToken ? 'found' : 'not found'}`,
  )

  if (userToken) {
    const user = await getUserByToken(userToken)
    if (user && user.isActive) {
      log('info', `Authenticated remote user: ${user.name} (id: ${user.id})`)
      log(
        'debug',
        `User permissions (${user.permissions.length}): ${user.permissions.join(', ')}`,
      )
      updateUserLastUsed(user.id)
      return {
        response: null,
        context: {
          authType: 'user',
          userId: user.id,
          permissions: user.permissions,
        },
      }
    }
    log(
      'info',
      `Invalid or inactive user token: ${userToken.substring(0, 10)}...`,
    )
  }

  // 3. No valid auth for remote access
  log('info', 'Remote access denied: no valid authentication')
  return {
    response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }),
    context: null,
  }
}

/**
 * Admin-only middleware (localhost or system token)
 */
export async function adminOnlyMiddleware(req: Request): Promise<AuthResult> {
  if (isLocalhost(req)) {
    log('debug', 'Localhost admin access granted')
    return {
      response: null,
      context: { authType: 'app' },
    }
  }

  const bearerToken = extractBearerToken(req)
  if (bearerToken) {
    const isValid = await validateSystemToken(bearerToken)
    if (isValid) {
      log('debug', 'System token admin access granted')
      return {
        response: null,
        context: { authType: 'app' },
      }
    }
  }

  log('debug', 'Admin access denied: not localhost or valid system token')
  return {
    response: new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }),
    context: null,
  }
}

// Legacy exports for compatibility
export const combinedAuthMiddleware = authMiddleware
export const appOnlyAuthMiddleware = adminOnlyMiddleware
