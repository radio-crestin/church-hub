/**
 * YouTube OAuth authentication error types and utilities.
 */

export enum YouTubeAuthErrorCode {
  INVALID_GRANT = 'invalid_grant',
  REFRESH_FAILED = 'refresh_failed',
  NOT_AUTHENTICATED = 'not_authenticated',
  NETWORK_ERROR = 'network_error',
}

export interface YouTubeAuthError {
  code: YouTubeAuthErrorCode
  message: string
  requiresReauth: boolean
}

/**
 * Parses Google OAuth error responses to determine if re-authentication is required.
 * Google returns 'invalid_grant' when refresh token is expired, revoked, or invalid.
 */
export function parseGoogleAuthError(error: unknown): YouTubeAuthError {
  const errorMessage =
    error instanceof Error ? error.message : 'Unknown error occurred'

  // Check for invalid_grant error (expired/revoked refresh token)
  if (
    errorMessage.includes('invalid_grant') ||
    errorMessage.includes('Token has been expired or revoked')
  ) {
    return {
      code: YouTubeAuthErrorCode.INVALID_GRANT,
      message: 'YouTube session has expired. Please reconnect.',
      requiresReauth: true,
    }
  }

  // Check for network errors
  if (
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('ETIMEDOUT') ||
    errorMessage.includes('fetch failed')
  ) {
    return {
      code: YouTubeAuthErrorCode.NETWORK_ERROR,
      message: 'Network error while refreshing YouTube token.',
      requiresReauth: false,
    }
  }

  // Default to refresh failed - may or may not require re-auth
  return {
    code: YouTubeAuthErrorCode.REFRESH_FAILED,
    message: errorMessage,
    requiresReauth: true,
  }
}
