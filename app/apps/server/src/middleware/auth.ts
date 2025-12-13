import type { AuthResult } from './types'
import { verifyAuthToken } from '../crypto'
import { getUserByToken, updateUserLastUsed } from '../service/users'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
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
 * Combined authentication middleware
 * Supports both Bearer token (app auth) and cookie (user auth)
 */
export async function combinedAuthMiddleware(
  req: Request,
): Promise<AuthResult> {
  // 1. Check Bearer token first (app auth)
  const authHeader = req.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length)
    const valid = await verifyAuthToken(token)
    if (valid) {
      log('debug', 'Authenticated via Bearer token (app)')
      return {
        response: null,
        context: { authType: 'app' },
      }
    }
    log('debug', 'Invalid Bearer token')
  }

  // 2. Check user cookie
  const cookieHeader = req.headers.get('Cookie') || ''
  const cookies = parseCookies(cookieHeader)
  const userToken = cookies['user_auth']

  if (userToken) {
    const user = await getUserByToken(userToken)
    if (user && user.isActive) {
      log('debug', `Authenticated via cookie (user: ${user.name})`)
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
    log('debug', 'Invalid or inactive user token')
  }

  // 3. No valid auth
  log('debug', 'No valid authentication found')
  return {
    response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }),
    context: null,
  }
}

/**
 * App-only authentication middleware
 * Only allows Bearer token authentication (for admin endpoints)
 */
export async function appOnlyAuthMiddleware(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length)
    const valid = await verifyAuthToken(token)
    if (valid) {
      log('debug', 'Authenticated via Bearer token (app-only)')
      return {
        response: null,
        context: { authType: 'app' },
      }
    }
  }

  log('debug', 'App-only auth failed: missing or invalid Bearer token')
  return {
    response: new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }),
    context: null,
  }
}
