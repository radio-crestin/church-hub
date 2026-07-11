const YOUTUBE_OAUTH_SERVER =
  (import.meta.env.VITE_YOUTUBE_OAUTH_SERVER as string) ||
  'https://churchub-backend.radiocrestin.ro'

/**
 * Builds the Google OAuth URL for connecting the Google account (YouTube + Drive
 * backup share one connection). Uses `redirect` mode with a localhost return
 * URL so the link works when pasted into ANY browser tab — including a private /
 * incognito window, which is handy for connecting a different Google account
 * than the one the default browser is already signed into.
 *
 * The callback lands on `http://localhost:3000/auth/youtube/callback`, served by
 * the local app server, which stores the tokens — so it works regardless of
 * which browser (or profile) completes the flow.
 */
export function buildGoogleAuthUrl(): string {
  const callbackOrigin = 'http://localhost:3000'
  const url = new URL('/auth/youtube', YOUTUBE_OAUTH_SERVER)
  url.searchParams.set('origin', callbackOrigin)
  url.searchParams.set('mode', 'redirect')
  url.searchParams.set('returnUrl', `${callbackOrigin}/auth/youtube/callback`)
  return url.toString()
}
