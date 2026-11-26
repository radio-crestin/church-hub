import { WEB_APP_API_ORIGIN } from '~/config'
import { installTunnel, type Tunnel } from '~/features/remote-access'
import {
  setLoadingError,
  updateLoadingMessage,
} from '~/features/startup/loadingScreen'
import { startupText } from '~/features/startup/startupText'
import { setStoredUserToken } from '~/service/api-url'
import { createLogger } from '~/utils/logger'
import { pcRoomActive } from './pcRoomActive'
import { reachScreen, type ScreenReach, screenLinkStands } from './reachScreen'
import type { ScreenLinkTarget } from './screenLinkUrl'

const logger = createLogger('screen-links')

/** A display that couldn't reach its host tries again this often. */
const RETRY_MS = 10_000
/** How often a display checks its link and looks for the church PC. */
const WATCH_MS = 30_000

/** The church PC when it answers and honours the link, else the phone. */
async function reachHost(link: ScreenLinkTarget) {
  if (link.pcRoom && (await pcRoomActive(link.relay, link.pcRoom))) {
    const pc = await reachScreen(link, link.pcRoom)
    if (pc.kind === 'open') return { reach: pc, onPc: true }
  }
  return { reach: await reachScreen(link, link.room), onPc: false }
}

function failed(reach: Exclude<ScreenReach, { kind: 'open' }>) {
  const refused = reach.kind === 'refused'
  setLoadingError(
    startupText(refused ? 'screenLinkRevoked' : 'screenUnreachable'),
    startupText(refused ? 'screenLinkRevokedHint' : 'screenUnreachableHint'),
    { label: startupText('retry'), onClick: () => window.location.reload() },
    undefined,
    // Nothing failed in the app: no report was sent.
    false,
  )
  // A phone that comes back is found on its own: a TV has nobody to tap.
  if (!refused) setTimeout(() => window.location.reload(), RETRY_MS)
}

/**
 * Another device (a TV, a laptop) opened a screen link (T-214): it shows
 * that screen from the church PC when it answers, else from the phone that
 * made the link, over WebRTC, signed in with the link alone. Every 30 s it
 * checks the link still stands, and moves to the PC once the PC is back.
 */
export async function startScreenDisplay(link: ScreenLinkTarget) {
  updateLoadingMessage(startupText('reachingScreen'))
  const { reach, onPc } = await reachHost(link)
  if (reach.kind !== 'open') return failed(reach)

  let current: Tunnel = reach.tunnel
  let currentOnPc = onPc
  const use = (tunnel: Tunnel) => {
    current = tunnel
    installTunnel(tunnel, WEB_APP_API_ORIGIN)
    // The host gone, or the link cut: the next start finds out which.
    tunnel.onClose(() => {
      if (tunnel === current) window.location.reload()
    })
  }
  setStoredUserToken(link.token)
  use(current)

  setInterval(async () => {
    if (!(await screenLinkStands(current, link.token))) {
      logger.info('The screen link no longer stands')
      current.close()
      return
    }
    if (currentOnPc || !link.pcRoom) return
    if (!(await pcRoomActive(link.relay, link.pcRoom))) return
    const pc = await reachScreen(link, link.pcRoom)
    if (pc.kind !== 'open') return
    logger.info('The church PC is back: the screen moves to it')
    const phone = current
    currentOnPc = true
    use(pc.tunnel)
    phone.close()
  }, WATCH_MS)

  await import('~/router')
}
