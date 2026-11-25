import { createUnframer, sendFramed } from './framing'
import { getRemoteAccessOrigin } from './remoteAccessListener'
import type { ComputerMessage, PhoneMessage } from './tunnelProtocol'
import { log } from '../../utils/fileLogger'

const logger = {
  warn: (msg: string, data?: unknown) =>
    log('remote-access', 'warn', msg, data),
}

/** Headers the tunnel sets itself, never the phone's. */
const DROPPED_HEADERS = new Set(['host', 'connection', 'content-length'])

/**
 * One phone's tunnel: replays its HTTP requests and WebSockets on the
 * remote-access listener (requests from elsewhere, never this machine).
 */
export function createTunnelSession(sendText: (text: string) => void) {
  const origin = getRemoteAccessOrigin()
  const sockets = new Map<number, WebSocket>()
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
    const response = await fetch(url, {
      method: message.method,
      headers,
      body: message.body ? Buffer.from(message.body, 'base64') : undefined,
      redirect: 'manual',
    })
    const responseHeaders: Array<[string, string]> = []
    response.headers.forEach((value, name) =>
      responseHeaders.push([name, value]),
    )
    send({
      type: 'http',
      id: message.id,
      status: response.status,
      headers: responseHeaders,
      body: Buffer.from(await response.arrayBuffer()).toString('base64'),
    })
  }

  const openSocket = (id: number, path: string) => {
    const url = toServerUrl(path)
    if (!url) {
      send({ type: 'ws-close', id })
      return
    }
    url.protocol = 'ws:'
    const socket = new WebSocket(url)
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
