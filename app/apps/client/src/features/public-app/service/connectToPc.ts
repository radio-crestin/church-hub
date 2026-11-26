import { openTunnel, type Tunnel, tunnelFetch } from '~/features/remote-access'
import { setStoredUserToken } from '~/service/api-url'
import { createLogger } from '~/utils/logger'
import type { ChurchBinding } from './churchBinding'
import { PC_API_ORIGIN } from './pcApiOrigin'

const logger = createLogger('public-app')

/** Signs in on the PC with the device token: that user's session token. */
async function signIn(tunnel: Tunnel, deviceToken: string): Promise<string> {
  const response = await tunnelFetch(
    tunnel,
    new Request(`${PC_API_ORIGIN}/api/auth/device-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: deviceToken }),
    }),
    null,
  )
  if (!response.ok) throw new Error(`device login: HTTP ${response.status}`)
  const { token } = (await response.json()) as { token: string }
  return token
}

/**
 * Connects this phone to its church's PC over WebRTC (T-174), signaled in
 * the PC's room on the relay (the join link's `p`), and signs in there as
 * the device's user (kept as the stored user token, sent as X-User-Auth).
 * Null when the PC isn't there (off, or remote access off) or refuses the
 * device: the app then reads the cloud.
 */
export async function connectToPc(
  binding: ChurchBinding,
): Promise<Tunnel | null> {
  if (!binding.pcSignalId) return null
  let tunnel: Tunnel
  try {
    tunnel = await openTunnel({
      relay: binding.relayUrl,
      secret: binding.pcSignalId,
    })
  } catch (error) {
    logger.info('The church computer is not reachable over WebRTC', error)
    return null
  }
  try {
    setStoredUserToken(await signIn(tunnel, binding.token))
    return tunnel
  } catch (error) {
    logger.warn('The church computer refused this device', error)
    tunnel.close()
    return null
  }
}
