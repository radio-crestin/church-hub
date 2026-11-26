import { randomId } from '../sync/randomId'
import { constantTimeEqual } from '../utils/constantTimeEqual'
import { createSignedToken, readSignedToken } from '../backup/auth/signedToken'

/** How long an admin stays signed in. */
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60
/** Sent as __Host-chadmin: HttpOnly, Secure, SameSite=Strict, host-only. */
export const SESSION_COOKIE = 'chadmin'
/** The sign-in in progress (__Host-chadmin-flow): Lax, to survive Google's redirect back. */
export const FLOW_COOKIE = 'chadmin-flow'

export interface AdminSession {
  sub: string
  email: string
  /** The value every changing call must send in X-CSRF-Token. */
  csrf: string
  exp: number
}

/** A signed session for an admin who just signed in, with a fresh CSRF token. */
export function createAdminSession(
  admin: { sub: string; email: string },
  secret: string
): Promise<string> {
  return createSignedToken(
    'chad',
    {
      sub: admin.sub,
      email: admin.email,
      csrf: randomId(24),
      exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS,
    },
    secret
  )
}

export const readAdminSession = (token: string | undefined, secret: string) =>
  readSignedToken<AdminSession>('chad', token, secret)

/** True when the request's X-CSRF-Token is the session's (constant time). */
export const csrfMatches = (session: AdminSession, header: string | undefined) =>
  typeof header === 'string' && constantTimeEqual(header, session.csrf)
