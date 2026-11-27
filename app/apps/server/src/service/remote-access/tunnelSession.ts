import { createUnframer, sendFramed } from './framing'
import type { ComputerMessage, PhoneMessage } from './tunnelProtocol'
import { log } from '../../utils/fileLogger'

const logger = {
  warn: (msg: string, data?: unknown) =>
    log('remote-access', 'warn', msg, data),
}

/**
 * The largest body a tunnel carries: it travels whole, as base64 JSON, so
 * a bigger file (a long video) is refused (413) and the phone shows it as
 * unavailable rather than stalling the channel.
 */
export const TUNNEL_MAX_BODY_BYTES = 64 * 1024 * 1024

/** Headers the tunnel sets itself, never the phone's. */
const DROPPED_HEADERS = new Set(['host', 'connection', 'content-length'])

/** The part of a WebSocket a tunnel session uses. */
export interface TunnelSocket {
  onopen: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onclose: (() => void) | null
  send(data: string): void
  close(): void
}

/** Where a tunnel session replays what comes in. */
export interface TunnelTarget {
  /** The server's origin: requests only ever reach it. */
  origin: string
  fetch(url: URL, init: RequestInit): Promise<Response>
  openSocket(url: URL): TunnelSocket
}

const toBase64 = (bytes: Uint8Array) => {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

const fromBase64 = (base64: string) =>
  Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))

/**
 * One tunnel's session: replays its HTTP requests and WebSockets on a
 * server. On the PC, a phone's WebRTC tunnel on the remote-access listener
 * (requests from elsewhere, never this machine: remoteAccessTarget); in a
 * browser, the page's requests on the server running in its worker.
 */
export function createTunnelSession(
  sendText: (text: string) => void,
  target: TunnelTarget,
) {
  const { origin } = target
  const sockets = new Map<number, TunnelSocket>()
  const send = (message: ComputerMessage) => sendFramed(sendText, message)

  /** The URL on this server, or null for anything that would leave it. */
  const toServerUrl = (path: string) => {
    if (!path.startsWith('/') || path.startsWith('//')) return null
    const url = new URL(path, origin)
    return url.origin === origin ? url : null
  }

  const forwardHttp = async (
    message: Extract<PhoneMessage, { type: 'http' }>,
  ) => {
    const url = toServerUrl(message.path)
    if (!url) {
      send({ type: 'http', id: message.id, status: 400, headers: [], body: '' })
      return
    }
    const headers = message.headers.filter(
      ([name]) => !DROPPED_HEADERS.has(name.toLowerCase()),
    )
    const response = await target.fetch(url, {
      method: message.method,
      headers,
      body: message.body ? fromBase64(message.body) : undefined,
      redirect: 'manual',
    })
    const length = Number(response.headers.get('Content-Length'))
    if (length > TUNNEL_MAX_BODY_BYTES) {
      await response.body?.cancel()
      send({ type: 'http', id: message.id, status: 413, headers: [], body: '' })
      return
    }
    const responseHeaders: Array<[string, string]> = []
    response.headers.forEach((value, name) =>
      responseHeaders.push([name, value]),
    )
    send({
      type: 'http',
      id: message.id,
      status: response.status,
      headers: responseHeaders,
      body: toBase64(new Uint8Array(await response.arrayBuffer())),
    })
  }

  const openSocket = (id: number, path: string) => {
    const url = toServerUrl(path)
    if (!url) {
      send({ type: 'ws-close', id })
      return
    }
    url.protocol = 'ws:'
    const socket = target.openSocket(url)
    sockets.set(id, socket)
    socket.onopen = () => send({ type: 'ws-open', id })
    socket.onmessage = (event) =>
      send({ type: 'ws-message', id, data: String(event.data) })
    socket.onclose = () => {
      sockets.delete(id)
      send({ type: 'ws-close', id })
    }
  }

  const receive = createUnframer((raw) => {
    const message = raw as PhoneMessage
    switch (message.type) {
      case 'http':
        forwardHttp(message).catch((error) => {
          logger.warn('Tunneled request failed', { error: String(error) })
          send({
            type: 'http',
            id: message.id,
            status: 502,
            headers: [],
            body: '',
          })
        })
        break
      case 'ws-open':
        openSocket(message.id, message.path)
        break
      case 'ws-send':
        sockets.get(message.id)?.send(message.data)
        break
      case 'ws-close':
        sockets.get(message.id)?.close()
        break
    }
  })

  return {
    receive,
    close: () => {
      for (const socket of sockets.values()) socket.close()
      sockets.clear()
    },
  }
}
