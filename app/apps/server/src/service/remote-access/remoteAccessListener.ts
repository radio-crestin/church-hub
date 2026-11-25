import { registerStandInListener } from '../../utils/peerAddress'

/**
 * Where a phone's tunnel reaches this server: a loopback listener of its own,
 * whose requests count as a device elsewhere (REMOTE_PEER), never as this
 * machine. A phone on the tunnel signs in with its own account like any LAN
 * device: no passwordless login, no pairing codes, no localhost-only routes.
 */
const REMOTE_PEER = '192.0.2.20'

let listenerOrigin: string | null = null

/** Records the listener index.ts started on a free loopback port. */
export function registerRemoteAccessListener(port: number) {
  registerStandInListener(port, REMOTE_PEER)
  listenerOrigin = `http://127.0.0.1:${port}`
}

/** The tunnel listener's origin, once the server has started. */
export function getRemoteAccessOrigin(): string {
  if (!listenerOrigin) throw new Error('Remote access listener not started')
  return listenerOrigin
}
