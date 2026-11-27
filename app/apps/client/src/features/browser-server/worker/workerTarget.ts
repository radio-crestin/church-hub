import { cloudMediaId, cloudMediaResponse } from './cloudMediaResponse'
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

/**
 * Where the server sees its requests come from: this machine. The page is
 * this device's own app, its only client, as the desktop app's windows are
 * the PC's: what the PC keeps to its own machine (sync, settings) is the
 * device's here.
 */
const ORIGIN = 'http://localhost'
const PEER = { address: '127.0.0.1', family: 'IPv4' as const, port: 0 }

/**
 * The request as the server reads it. A browser drops a Request's Host
 * header (a forbidden name), which the server checks to tell this machine
 * from the LAN: it is put back on the request's own headers.
 */
function toServerRequest(url: URL | string, init?: RequestInit): Request {
  const request = new Request(url, init)
  const headers = new Headers(request.headers)
  headers.set('Host', new URL(request.url).host)
  return Object.defineProperty(request, 'headers', { value: headers })
}

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
    void handleRequest(toServerRequest(url.href.replace(/^ws/, 'http')), server)
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
 * the routes only the church PC has refused first. Gallery files are read
 * from the church's bucket: the PC holds them, not this browser.
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
      const mediaId = cloudMediaId(url, init?.method ?? 'GET')
      if (mediaId) return cloudMediaResponse(mediaId)
      return runAsRequest(() =>
        handleRequest(toServerRequest(url, init), server),
      )
    },
    openSocket: (url) => new WorkerSocket(url, handleRequest),
  }
}
