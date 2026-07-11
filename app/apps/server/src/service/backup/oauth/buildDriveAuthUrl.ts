import { DRIVE_SCOPES } from './config'

interface BuildDriveAuthUrlParams {
  clientId: string
  redirectUri: string
  codeChallenge: string
  state: string
}

/**
 * Builds the Google OAuth authorization URL for the Drive-backup connection
 * (PKCE S256, offline access so a refresh token is issued, forced consent).
 */
export function buildDriveAuthUrl(params: BuildDriveAuthUrlParams): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', DRIVE_SCOPES.join(' '))
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('access_type', 'offline')
  // Always show the account chooser (so users can pick/switch which Google
  // account to back up with) AND force consent (so a refresh token is issued).
  url.searchParams.set('prompt', 'select_account consent')
  url.searchParams.set('state', params.state)
  return url.toString()
}
