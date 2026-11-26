import { getRemoteAccessOrigin } from './remoteAccessListener'
import type { TunnelSocket, TunnelTarget } from './tunnelSession'

/**
 * A phone's tunnel replays on the remote-access listener, so the server
 * sees its requests as coming from elsewhere, never from this machine.
 */
export function remoteAccessTarget(): TunnelTarget {
  return {
    origin: getRemoteAccessOrigin(),
    fetch: (url, init) => fetch(url, init),
    openSocket: (url) => new WebSocket(url) as TunnelSocket,
  }
}
