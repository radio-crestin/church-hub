import { getStoredUserToken } from '~/service/api-url'
import type { Tunnel } from './createTunnel'
import { TunnelWebSocket } from './TunnelWebSocket'
import { tunnelFetch } from './tunnelFetch'
import { setTunnelOpen } from './tunnelState'

/** The tunnel the page's traffic to the computer goes through now. */
let current: { tunnel: Tunnel; apiOrigin: string } | null = null

/** Points the page's fetch and WebSocket at `current` (once per page). */
function patchFetchAndWebSocket() {
  const originalFetch = window.fetch.bind(window)
  const OriginalWebSocket = window.WebSocket
  const target = (url: string | URL, protocol: 'http' | 'ws') => {
    if (!current) return null
    const origin = current.apiOrigin.replace(/^http/, protocol)
    return new URL(url).origin === origin ? current.tunnel : null
  }

  const tunneledFetch = (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const request = new Request(input, init)
    const tunnel = target(request.url, 'http')
    if (!tunnel) return originalFetch(input, init)
    return tunnelFetch(tunnel, request, getStoredUserToken())
  }
  window.fetch = Object.assign(tunneledFetch, { preconnect: () => {} })

  window.WebSocket = class extends OriginalWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      const tunnel = target(url, 'ws')
      if (tunnel) {
        return new TunnelWebSocket(String(url), tunnel) as unknown as WebSocket
      }
      super(url, protocols)
    }
  } as typeof WebSocket
}

/**
 * From now on, the page's fetch and WebSocket to the computer's address
 * (`apiOrigin`) go over the tunnel; every other address is untouched. Called
 * again (a new tunnel after the last one closed), it swaps the tunnel in.
 */
export function installTunnel(tunnel: Tunnel, apiOrigin: string) {
  if (!current) patchFetchAndWebSocket()
  current = { tunnel, apiOrigin }
  setTunnelOpen(true)
}
