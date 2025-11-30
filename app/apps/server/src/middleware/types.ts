import type { DevicePermissions } from '../service/devices'

/**
 * Authentication type
 */
export type AuthType = 'app' | 'device'

/**
 * Request context after authentication
 */
export interface RequestContext {
  authType: AuthType
  deviceId?: number
  permissions?: DevicePermissions
}

/**
 * Result of authentication middleware
 */
export interface AuthResult {
  response: Response | null
  context: RequestContext | null
}
