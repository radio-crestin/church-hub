/**
 * The Worker's non-secret [vars] that are the same in every deployment
 * (wrangler.toml); the Node entry uses them unless the environment overrides
 * them. Host-specific ones (DRIVE_REDIRECT_URI, OWNER_REDIRECT_URI,
 * YOUTUBE_REDIRECT_URI) always come from the environment.
 */
export const WORKER_VAR_DEFAULTS = {
  YOUTUBE_SCOPE: 'https://www.googleapis.com/auth/youtube.force-ssl',
  DRIVE_SCOPE:
    'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.appdata',
  COOKIE_NAME: 'yt_oauth_state',
  COOKIE_MAX_AGE: '600',
}
