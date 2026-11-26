import { fetchJsonWithStatus } from '~/utils/fetcher'
import { disconnectScreens, hostScreens } from './screenHost'
import { buildScreenLinkUrl } from './screenLinkUrl'

/** A link just made: its URL (shown once) and when it stops working. */
export interface MadeScreenLink {
  id: string
  url: string
  expiresAt: number
}

interface CreatedLink {
  id: string
  token: string
  expiresAt: number
}

/**
 * Makes a link another device shows `screenId` through (T-214), and opens
 * this phone's room for it.
 */
export async function makeScreenLink(
  screenId: number,
): Promise<MadeScreenLink> {
  const { status, body } = await fetchJsonWithStatus<{
    data?: CreatedLink
    error?: string
  }>('/api/screen-links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ screenId }),
  })
  if (status !== 201 || !body.data) {
    throw new Error(body.error ?? `Screen link not made (HTTP ${status})`)
  }
  const { id, token, expiresAt } = body.data
  const where = await hostScreens()
  return {
    id,
    expiresAt,
    url: buildScreenLinkUrl(window.location.origin, {
      ...where,
      token,
      screenId,
    }),
  }
}

/**
 * Revokes a link: every device showing a screen through this phone is cut
 * off; those whose link still stands connect again, the revoked one hears
 * it was revoked.
 */
export async function revokeScreenLink(id: string): Promise<void> {
  const { status } = await fetchJsonWithStatus(`/api/screen-links/${id}`, {
    method: 'DELETE',
  })
  if (status !== 200)
    throw new Error(`Screen link not revoked (HTTP ${status})`)
  disconnectScreens()
}
