import { createUnframer, sendFramed } from './framing'
import type { ComputerMessage, PhoneMessage } from './tunnelProtocol'

export interface TunnelResponse {
  status: number
  headers: Array<[string, string]>
  body: Uint8Array
}

export interface TunnelSocketEvents {
  onOpen: () => void
  onMessage: (data: string) => void
  onClose: () => void
}

export interface Tunnel {
  request: (
    message: Omit<Extract<PhoneMessage, { type: 'http' }>, 'type' | 'id'>,
  ) => Promise<TunnelResponse>
  openSocket: (
    path: string,
    events: TunnelSocketEvents,
  ) => {
    send: (data: string) => void
    close: () => void
  }
  onClose: (listener: () => void) => void
  /** Ends the tunnel: its onClose listeners are called. */
  close: () => void
}

const toBytes = (base64: string) =>
  Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))

/**
 * Requests and WebSockets to the computer's server over an open data
 * channel (the computer replays them: server service/remote-access).
 */
export function createTunnel(channel: RTCDataChannel): Tunnel {
  let nextId = 0
  const pending = new Map<number, (response: TunnelResponse) => void>()
  const sockets = new Map<number, TunnelSocketEvents>()
  const closeListeners: Array<() => void> = []
  const send = (message: PhoneMessage) =>
    sendFramed((text) => channel.send(text), message)

  channel.onmessage = (event) =>
    receive(typeof event.data === 'string' ? event.data : '')
  const receive = createUnframer((raw) => {
    const message = raw as ComputerMessage
    switch (message.type) {
      case 'http':
        pending.get(message.id)?.({
          status: message.status,
          headers: message.headers,
          body: toBytes(message.body),
        })
        pending.delete(message.id)
        break
      case 'ws-open':
        sockets.get(message.id)?.onOpen()
        break
      case 'ws-message':
        sockets.get(message.id)?.onMessage(message.data)
        break
      case 'ws-close':
        sockets.get(message.id)?.onClose()
        sockets.delete(message.id)
        break
    }
  })

  let closed = false
  /**
   * Once, whichever comes first: the channel's close event, or close() (a
   * failed connection can end the channel without that event).
   */
  const shutdown = () => {
    if (closed) return
    closed = true
    for (const resolve of pending.values()) {
      resolve({ status: 503, headers: [], body: new Uint8Array() })
    }
    pending.clear()
    for (const socket of sockets.values()) socket.onClose()
    sockets.clear()
    for (const listener of closeListeners) listener()
  }
  channel.onclose = shutdown

  return {
    request: (message) =>
      new Promise((resolve) => {
        const id = ++nextId
        pending.set(id, resolve)
        send({ type: 'http', id, ...message })
      }),
    openSocket: (path, events) => {
      const id = ++nextId
      sockets.set(id, events)
      send({ type: 'ws-open', id, path })
      return {
        send: (data) => send({ type: 'ws-send', id, data }),
        close: () => send({ type: 'ws-close', id }),
      }
    },
    onClose: (listener) => closeListeners.push(listener),
    close: () => {
      channel.close()
      shutdown()
    },
  }
}
