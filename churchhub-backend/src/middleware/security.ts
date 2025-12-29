import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import type { MiddlewareHandler } from 'hono'
import type { Bindings } from '../types'

/**
 * Creates security middleware array for the Hono app.
 */
export function createSecurityMiddleware(): MiddlewareHandler<{
  Bindings: Bindings
}>[] {
  return [
    secureHeaders({
      xFrameOptions: 'DENY',
      xContentTypeOptions: 'nosniff',
      referrerPolicy: 'strict-origin-when-cross-origin',
      strictTransportSecurity: 'max-age=31536000; includeSubDomains',
    }),
  ]
}

/**
 * Creates CORS middleware with dynamic origin validation.
 */
export function createCorsMiddleware(): MiddlewareHandler<{
  Bindings: Bindings
}> {
  return cors({
    origin: (origin, c) => {
      const allowedOrigins = c.env.ALLOWED_ORIGINS?.split(',').map((o: string) =>
        o.trim()
      )
      if (allowedOrigins?.includes(origin)) {
        return origin
      }
      return null
    },
    allowMethods: ['GET', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    credentials: true,
    maxAge: 86400,
  })
}

/**
 * Validates that an origin is in the allowed list.
 */
export function isAllowedOrigin(
  origin: string | undefined,
  allowedOrigins: string
): boolean {
  if (!origin) return false
  const origins = allowedOrigins.split(',').map((o) => o.trim())
  return origins.includes(origin)
}
