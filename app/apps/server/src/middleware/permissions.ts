import type { RequestContext } from './types'
import type { Feature } from '../service/devices'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
}

type Action = 'read' | 'write' | 'delete'

/**
 * Creates a permission checker for a specific feature and action
 * Returns null if permitted, or a 403 Response if forbidden
 */
export function requirePermission(
  feature: Feature,
  action: Action,
): (context: RequestContext) => Response | null {
  return (context: RequestContext): Response | null => {
    // App auth bypasses permission checks (full access)
    if (context.authType === 'app') {
      log('debug', `App auth: bypassing ${feature}:${action} check`)
      return null
    }

    // Check device permissions
    if (!context.permissions) {
      log('warning', `No permissions found for device auth`)
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

    const featurePerms = context.permissions[feature]
    if (!featurePerms) {
      log('warning', `No permissions for feature: ${feature}`)
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: `No permissions for ${feature}`,
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const hasPermission = featurePerms[action] === true
    if (!hasPermission) {
      log(
        'warning',
        `Permission denied: ${feature}:${action} for device ${context.deviceId}`,
      )
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: `Missing ${action} permission for ${feature}`,
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    log('debug', `Permission granted: ${feature}:${action}`)
    return null // Proceed
  }
}

/**
 * Checks multiple permissions at once
 * All permissions must be granted
 */
export function requireAllPermissions(
  permissions: Array<{ feature: Feature; action: Action }>,
): (context: RequestContext) => Response | null {
  return (context: RequestContext): Response | null => {
    for (const { feature, action } of permissions) {
      const result = requirePermission(feature, action)(context)
      if (result) return result
    }
    return null
  }
}

/**
 * Checks if any of the permissions are granted
 */
export function requireAnyPermission(
  permissions: Array<{ feature: Feature; action: Action }>,
): (context: RequestContext) => Response | null {
  return (context: RequestContext): Response | null => {
    // App auth always passes
    if (context.authType === 'app') {
      return null
    }

    for (const { feature, action } of permissions) {
      const featurePerms = context.permissions?.[feature]
      if (featurePerms?.[action] === true) {
        return null
      }
    }

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
}
