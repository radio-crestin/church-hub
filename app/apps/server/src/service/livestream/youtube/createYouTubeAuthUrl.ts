import { getBackendBaseUrl } from '../../backend'

export type YouTubeAuthMode = 'redirect' | 'postMessage'

/** The installed app: the backend sends Google's answer back to it. */
const CALLBACK_ORIGIN = 'http://localhost:3000'

/**
 * The page that signs the church into YouTube, on Church Hub's backend (it
 * holds the Google client). `redirect` (the desktop app) comes back to
 * /auth/youtube/callback; `postMessage` (a browser popup) posts the tokens to
 * its opener.
 */
export function createYouTubeAuthUrl(mode: YouTubeAuthMode): string {
  const url = new URL('/auth/youtube', getBackendBaseUrl())
  url.searchParams.set('origin', CALLBACK_ORIGIN)
  url.searchParams.set('mode', mode)
  if (mode === 'redirect') {
    url.searchParams.set(
      'returnUrl',
      `${CALLBACK_ORIGIN}/auth/youtube/callback`,
    )
  }
  return url.toString()
}
