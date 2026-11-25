import { getStoredUserToken } from '~/service/api-url'
import type { Tunnel } from './createTunnel'
import { TunnelWebSocket } from './TunnelWebSocket'
import { setTunnelOpen } from './tunnelState'

/** Statuses whose Response has no body. */
const NULL_BODY = new Set([101, 103, 204, 205, 304])

const toBase64 = (buffer: ArrayBuffer) => {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

/**
 * From now on, the page's fetch and WebSocket to the computer's address
 * (`apiOrigin`) go over the tunnel; every other address is untouched. The
 * phone signs in with its own token (X-User-Auth): the browser drops a
 * Cookie header set by hand.
 */
export function installTunnel(tunnel: Tunnel, apiOrigin: string) {
  const originalFetch = window.fetch.bind(window)
  const OriginalWebSocket = window.WebSocket
  const wsOrigin = apiOrigin.replace(/^http/, 'ws')

  const tunneledFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.origin !== apiOrigin) return originalFetch(input, init)

    const headers: Array<[string, string]> = []
    request.headers.forEach((value, name) => headers.push([name, value]))
    const token = getStoredUserToken()
    if (token && !request.headers.has('X-User-Auth')) {
      headers.push(['X-User-Auth', token])
    }
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
    const response = await tunnel.request({
      method: request.method,
      path: url.pathname + url.search,
      headers,
      body: hasBody ? toBase64(await request.arrayBuffer()) : undefined,
    })
    const body = NULL_BODY.has(response.status)
      ? null
      : new Blob([response.body as BlobPart])
    return new Response(body, {
      status: response.status,
      headers: response.headers,
    })
  }
  window.fetch = Object.assign(tunneledFetch, { preconnect: () => {} })

  window.WebSocket = class extends OriginalWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      if (new URL(url).origin === wsOrigin) {
        return new TunnelWebSocket(String(url), tunnel) as unknown as WebSocket
      }
      super(url, protocols)
    }
  } as typeof WebSocket

  setTunnelOpen(true)
}
