import { getBackendBaseUrl } from '../../backend'

export type YouTubeAuthMode = 'redirect' | 'postMessage'

/** The installed app: the backend sends Google's answer back to it. */
const CALLBACK_ORIGIN = 'http://localhost:3000'

/**
 * The page that signs the church into YouTube, on Church Hub's backend (it
 * holds the Google client). `redirect` (the desktop app) comes back to
 * /auth/youtube/callback with the sign-in's `state`; `postMessage` (a browser
 * popup) posts the tokens to its opener, which sends the state with them.
 */
export function createYouTubeAuthUrl(
  mode: YouTubeAuthMode,
  state: string,
): string {
  const url = new URL('/auth/youtube', getBackendBaseUrl())
  url.searchParams.set('origin', CALLBACK_ORIGIN)
  url.searchParams.set('mode', mode)
  if (mode === 'redirect') {
    const returnUrl = new URL('/auth/youtube/callback', CALLBACK_ORIGIN)
    returnUrl.searchParams.set('state', state)
    url.searchParams.set('returnUrl', returnUrl.toString())
  }
  return url.toString()
}
