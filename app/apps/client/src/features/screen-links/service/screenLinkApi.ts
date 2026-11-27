import { fetchJsonWithStatus } from '~/utils/fetcher'
import { canHostScreens, disconnectScreens, hostScreens } from './screenHost'
import { buildDirectScreenLinkUrl, buildScreenLinkUrl } from './screenLinkUrl'

/** A link just made: its URLs (shown once) and when it stops working. */
export interface MadeScreenLink {
  id: string
  expiresAt: number
  /**
   * Over the internet, through the public web app and WebRTC (the default);
   * null when the PC's remote access is off.
   */
  internet: string | null
  /** Directly on the church network, one per LAN address of the PC. */
  network: Array<{ address: string; url: string }>
}

interface CreatedLink {
  id: string
  token: string
  expiresAt: number
}

interface Endpoints {
  internet: { publicAppUrl: string; relay: string; room: string } | null
  network: { addresses: string[]; port: number }
}

/** Where devices reach the church PC: its room, and its LAN addresses. */
async function pcUrls(screenId: number, token: string) {
  const { status, body } = await fetchJsonWithStatus<{ data?: Endpoints }>(
    '/api/screen-links/endpoints',
  )
  if (status !== 200 || !body.data) {
    throw new Error(`Screen link endpoints not read (HTTP ${status})`)
  }
  const { internet, network } = body.data
  return {
    internet: internet
      ? buildScreenLinkUrl(internet.publicAppUrl, {
          relay: internet.relay,
          room: internet.room,
          pcRoom: null,
          token,
          screenId,
        })
      : null,
    network: network.addresses.map((address) => ({
      address,
      url: buildDirectScreenLinkUrl(
        `http://${address}:${network.port}`,
        screenId,
        token,
      ),
    })),
  }
}

/**
 * The phone running the church's server hosts the link itself, over the
 * internet only: it has no address on the network to be opened at.
 */
async function phoneUrls(screenId: number, token: string) {
  const where = await hostScreens()
  return {
    internet: buildScreenLinkUrl(window.location.origin, {
      ...where,
      token,
      screenId,
    }),
    network: [],
  }
}

/** Makes a link another device shows `screenId` through (T-214). */
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
  const urls = canHostScreens()
    ? await phoneUrls(screenId, token)
    : await pcUrls(screenId, token)
  return { id, expiresAt, ...urls }
}

/**
 * Revokes a link: every device showing a screen through this phone is cut
 * off; those whose link still stands connect again, the revoked one hears
 * it was revoked. A device of the PC's is refused at its next check.
 */
export async function revokeScreenLink(id: string): Promise<void> {
  const { status } = await fetchJsonWithStatus(`/api/screen-links/${id}`, {
    method: 'DELETE',
  })
  if (status !== 200)
    throw new Error(`Screen link not revoked (HTTP ${status})`)
  disconnectScreens()
}
