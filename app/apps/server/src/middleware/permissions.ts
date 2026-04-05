import type { RequestContext } from './types'
import type { Permission } from '../service/users'
import { createLogger } from '../utils/logger'

const logger = createLogger('permissions')

/**
 * Creates a permission checker for a specific permission
 * Returns null if permitted, or a 403 Response if forbidden
 */
export function requirePermission(
  permission: Permission,
): (context: RequestContext) => Response | null {
  return (context: RequestContext): Response | null => {
    // App auth bypasses permission checks (full access)
    if (context.authType === 'app') {
      logger.debug(`App auth: bypassing ${permission} check`)
      return null
    }

    // Check user permissions
    if (!context.permissions) {
      logger.warning(
        `No permissions found for user ${context.userId} - required: ${permission}`,
      )
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'No permissions configured',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const hasPermission = context.permissions.includes(permission)
    if (!hasPermission) {
      logger.warning(
        `Permission denied: ${permission} for user ${context.userId}. User has: ${context.permissions.join(', ')}`,
      )
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: `Missing permission: ${permission}`,
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    logger.debug(`Permission granted: ${permission}`)
    return null // Proceed
  }
}

/**
 * Checks if all specified permissions are granted
 */
export function requireAllPermissions(
  permissions: Permission[],
): (context: RequestContext) => Response | null {
  return (context: RequestContext): Response | null => {
    for (const permission of permissions) {
      const result = requirePermission(permission)(context)
      if (result) return result
    }
    return null
  }
}

/**
 * Checks if any of the permissions are granted
 */
export function requireAnyPermission(
  permissions: Permission[],
): (context: RequestContext) => Response | null {
  return (context: RequestContext): Response | null => {
    // App auth always passes
    if (context.authType === 'app') {
      return null
    }

    if (!context.permissions || context.permissions.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'No permissions configured',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const hasAny = permissions.some((p) => context.permissions?.includes(p))
    if (!hasAny) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'Insufficient permissions',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    return null
  }
}
