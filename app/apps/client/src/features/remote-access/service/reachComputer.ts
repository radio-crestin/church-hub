import { apiFetch } from '~/utils/apiFetch'
import { createLogger } from '~/utils/logger'
import { getRemotePairing } from './remotePairing'
import { installTunnel } from '../tunnel/installTunnel'
import { openTunnel } from '../tunnel/openTunnel'
import { setTunnelOpen } from '../tunnel/tunnelState'

const logger = createLogger('remote-access')

/** On the church Wi-Fi the computer answers well within this. */
const DIRECT_MS = 2500
/** After the tunnel drops, try again (the app starts over). */
const RECONNECT_MS = 3000

async function answersDirectly(apiUrl: string): Promise<boolean> {
  try {
    const res = await apiFetch(`${apiUrl}/ping`, {
      signal: AbortSignal.timeout(DIRECT_MS),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * The phone app at start-up: the computer's own address when it answers (on
 * the church Wi-Fi), else the WebRTC tunnel when the phone was paired with
 * remote access on. Resolves once the app can talk to the computer, or when
 * neither way works (the app then shows that it can't connect).
 */
export async function reachComputer(apiUrl: string): Promise<void> {
  if (await answersDirectly(apiUrl)) return
  const pairing = getRemotePairing()
  if (!pairing) return
  try {
    const tunnel = await openTunnel(pairing)
    installTunnel(tunnel, new URL(apiUrl).origin)
    logger.info('Connected to the computer over the internet')
    tunnel.onClose(() => {
      setTunnelOpen(false)
      logger.warn('Tunnel closed; starting over')
      setTimeout(() => window.location.reload(), RECONNECT_MS)
    })
  } catch (error) {
    logger.warn('The computer is not reachable from here', error)
  }
}
