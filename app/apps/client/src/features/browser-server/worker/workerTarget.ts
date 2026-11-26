import { needsChurchPc, needsChurchPcResponse } from './pcOnlyRoutes'
import { runAsRequest } from '../../../../../server/src/db/actingUser'
import type { FetchServer } from '../../../../../server/src/http/fetchServer'
import type {
  TunnelSocket,
  TunnelTarget,
} from '../../../../../server/src/service/remote-access/tunnelSession'
import {
  handleWebSocketClose,
  handleWebSocketMessage,
  handleWebSocketOpen,
  type WebSocketData,
} from '../../../../../server/src/websocket'

type HandleRequest = (req: Request, server: FetchServer) => Promise<Response>

/** The address the server sees its requests at: nobody's network. */
const ORIGIN = 'http://browser-server.invalid'

/** The peer every request comes from: this page, never this machine. */
const PEER = { address: '0.0.0.0', family: 'IPv4' as const, port: 0 }

/**
 * A WebSocket from the page to the server in this worker: opening it runs
 * the server's `/ws` route, whose upgrade hands the server a socket that
 * writes back here; the server's handlers do the rest, as on the PC.
 */
class WorkerSocket implements TunnelSocket {
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  private serverSide: { data: WebSocketData } | null = null
  private closed = false

  constructor(url: URL, handleRequest: HandleRequest) {
    const server = {
      port: 0,
      requestIP: () => PEER,
      upgrade: (_req: Request, options?: { data?: WebSocketData }) => {
        this.serverSide = this.connect(options?.data ?? { clientId: '' })
        return true
      },
    } as unknown as FetchServer
    void handleRequest(new Request(url.href.replace(/^ws/, 'http')), server)
      .then(() => {
        if (!this.serverSide) return this.end()
        handleWebSocketOpen(this.serverSide as never)
        this.onopen?.()
      })
      .catch(() => this.end())
  }

  private connect(data: WebSocketData) {
    return {
      data,
      readyState: 1,
      send: (message: string) => {
        if (!this.closed) this.onmessage?.({ data: message })
      },
      close: () => this.close(),
    }
  }

  send(data: string): void {
    if (this.serverSide && !this.closed) {
      handleWebSocketMessage(this.serverSide as never, data)
    }
  }

  close(): void {
    if (this.closed) return
    if (this.serverSide) handleWebSocketClose(this.serverSide as never)
    this.end()
  }

  private end(): void {
    this.closed = true
    this.onclose?.()
  }
}

/**
 * Where the page's tunnel replays in this worker: the server's own fetch
 * handler, each request as the server runs it (its own acting user), and
 * the routes only the church PC has refused first.
 */
export function workerTarget(handleRequest: HandleRequest): TunnelTarget {
  const server = {
    port: 0,
    requestIP: () => PEER,
    upgrade: () => false,
  } as unknown as FetchServer
  return {
    origin: ORIGIN,
    fetch: async (url, init) => {
      if (needsChurchPc(url.pathname)) return needsChurchPcResponse()
      return runAsRequest(() => handleRequest(new Request(url, init), server))
    },
    openSocket: (url) => new WorkerSocket(url, handleRequest),
  }
}
