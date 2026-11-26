import type { Tunnel } from './createTunnel'

/**
 * A WebSocket to the computer's server carried by the tunnel: the part of
 * the browser's WebSocket the app uses (readyState, on* handlers and
 * listeners, send, close).
 */
export class TunnelWebSocket extends EventTarget {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSING = 2
  readonly CLOSED = 3

  readyState = 0
  readonly protocol = ''
  readonly extensions = ''
  readonly bufferedAmount = 0
  binaryType: BinaryType = 'blob'
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  private readonly socket: ReturnType<Tunnel['openSocket']>

  constructor(
    readonly url: string,
    tunnel: Tunnel,
  ) {
    super()
    const { pathname, search } = new URL(url)
    this.socket = tunnel.openSocket(pathname + search, {
      onOpen: () => {
        this.readyState = this.OPEN
        this.emit(new Event('open'), this.onopen)
      },
      onMessage: (data) =>
        this.emit(new MessageEvent('message', { data }), this.onmessage),
      onClose: () => {
        if (this.readyState === this.CLOSED) return
        this.readyState = this.CLOSED
        this.emit(new CloseEvent('close', { code: 1000 }), this.onclose)
      },
    })
  }

  send(data: string) {
    if (this.readyState !== this.OPEN) throw new Error('WebSocket is not open')
    this.socket.send(data)
  }

  close() {
    if (this.readyState >= this.CLOSING) return
    this.readyState = this.CLOSING
    this.socket.close()
  }

  private emit<E extends Event>(
    event: E,
    handler: ((event: E) => void) | null,
  ) {
    handler?.call(this, event)
    this.dispatchEvent(event)
  }
}
