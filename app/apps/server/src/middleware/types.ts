import type { ScreenLink } from '../service/screen-links'
import type { Permission } from '../service/users'

/**
 * Authentication type
 */
export type AuthType = 'app' | 'user'

/**
 * Request context after authentication
 */
export interface RequestContext {
  authType: AuthType
  userId?: number
  permissions?: Permission[]
  /** Signed in with a screen link (T-214): the link. */
  screenLink?: ScreenLink
}

/**
 * Result of authentication middleware
 */
export interface AuthResult {
  response: Response | null
  context: RequestContext | null
}
