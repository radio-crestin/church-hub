import { getApiUrl } from '~/config'
import { setLoadingError } from '~/features/startup/loadingScreen'
import { startupText } from '~/features/startup/startupText'
import { parseDirectScreenLinkToken } from './screenLinkUrl'

/** How often a direct link's device checks its link still stands. */
const WATCH_MS = 30_000

/** Reloads once the link is revoked or expired: the start then says so. */
function watchScreenLink(api: string) {
  setInterval(async () => {
    const response = await fetch(`${api}/api/screen-links/session`, {
      credentials: 'include',
    })
    if (response.status === 401) window.location.reload()
  }, WATCH_MS)
}

/**
 * A device on the church network opened a direct screen link (T-214):
 * before the app mounts, it trades the link's token (kept in the address's
 * fragment, so a reload signs in again) for its session cookie, and checks
 * the link every 30 s. False when the link no longer stands: the page says
 * so instead. True for any other page.
 */
export async function signInWithScreenLink(): Promise<boolean> {
  const token = parseDirectScreenLinkToken(new URL(window.location.href))
  if (!token) return true
  const api = getApiUrl() ?? window.location.origin
  const response = await fetch(`${api}/api/screen-links/sign-in`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  if (!response.ok) {
    setLoadingError(
      startupText('screenLinkRevoked'),
      startupText('screenLinkRevokedHint'),
      { label: startupText('retry'), onClick: () => window.location.reload() },
      undefined,
      false,
    )
    return false
  }
  watchScreenLink(api)
  return true
}
