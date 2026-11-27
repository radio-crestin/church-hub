import { WEB_APP_API_ORIGIN } from '~/config'
import { openTunnel, type Tunnel, tunnelFetch } from '~/features/remote-access'
import { createLogger } from '~/utils/logger'
import type { ScreenLinkTarget } from './screenLinkUrl'

const logger = createLogger('screen-links')

/** What reaching a room with a screen link found. */
export type ScreenReach =
  | { kind: 'open'; tunnel: Tunnel }
  /** The host answered and refused the link: revoked or expired. */
  | { kind: 'refused' }
  | { kind: 'unreachable' }

/** Whether the server behind `tunnel` honours the link's token. */
export async function screenLinkStands(
  tunnel: Tunnel,
  token: string,
): Promise<boolean> {
  const response = await tunnelFetch(
    tunnel,
    new Request(`${WEB_APP_API_ORIGIN}/api/screen-links/session`),
    token,
  )
  return response.ok
}

/** Opens a tunnel to `room` and checks the link there. */
export async function reachScreen(
  { relay, token }: ScreenLinkTarget,
  room: string,
): Promise<ScreenReach> {
  let tunnel: Tunnel
  try {
    tunnel = await openTunnel({ relay, secret: room })
  } catch (error) {
    logger.info('The screen host is not reachable', error)
    return { kind: 'unreachable' }
  }
  if (await screenLinkStands(tunnel, token)) return { kind: 'open', tunnel }
  tunnel.close()
  return { kind: 'refused' }
}
