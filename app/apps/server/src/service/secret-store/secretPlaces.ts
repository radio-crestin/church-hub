import type { SecretPlace } from './secretPlace'

const at = (table: string, column: string, row?: string): SecretPlace => ({
  table,
  column,
  ...(row !== undefined && { row }),
})

/**
 * The places of the secrets kept in their own columns. Each feature's store
 * seals and opens its values here; stored-secrets/secretColumns lists the
 * same columns for sealStoredSecrets.
 */
export const secretPlaces = {
  serverSecret: (key: string) => at('server_secrets', 'value', key),
  youtubeAccessToken: at('youtube_auth', 'access_token'),
  youtubeRefreshToken: at('youtube_auth', 'refresh_token'),
  driveAccessToken: at('google_drive_auth', 'access_token'),
  driveRefreshToken: at('google_drive_auth', 'refresh_token'),
  cloudServerToken: at('cloud_sync', 'server_token'),
  /** The church's unlisted read path: its secret part opens the library. */
  cloudReadUrl: at('cloud_sync', 'read_url'),
  obsPassword: at('obs_config', 'password'),
  s3SecretAccessKey: at('song_source_storage', 'secret_access_key'),
  /** A user's token, tied to its row by the token's hash. */
  userToken: (tokenHash: string) => at('users', 'token', tokenHash),
  systemToken: (name: string) => at('app_sessions', 'session_token', name),
  column: at,
}
