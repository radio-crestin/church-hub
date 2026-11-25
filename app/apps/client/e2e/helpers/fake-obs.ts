import type { AddressInfo } from 'node:net'
import { type WebSocket, WebSocketServer } from 'ws'

/**
 * A tiny OBS stand-in for specs: speaks obs-websocket v5 (Hello, Identify,
 * requests, events) on 127.0.0.1 without a password. A spec points Church Hub
 * at it (PUT /api/livestream/obs/config, POST /api/livestream/obs/connect),
 * then plays what an operator does in OBS: `selectScene`, `setStreaming`,
 * `setRecording`.
 */
export class FakeOBS {
  scene = 'Start'
  streaming = false
  recording = false
  private server: WebSocketServer | undefined
  private clients = new Set<WebSocket>()

  async start(): Promise<number> {
    this.server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
    this.server.on('connection', (socket) => this.accept(socket))
    await new Promise<void>((resolve) =>
      this.server?.on('listening', () => resolve()),
    )
    return (this.server.address() as AddressInfo).port
  }

  async stop(): Promise<void> {
    for (const socket of this.clients) socket.terminate()
    await new Promise<void>((resolve) => this.server?.close(() => resolve()))
  }

  /** The operator picks a scene in OBS. */
  selectScene(sceneName: string) {
    this.scene = sceneName
    this.emit('CurrentProgramSceneChanged', { sceneName })
  }

  /** The stream goes live or ends, through OBS's own states like the real one. */
  setStreaming(active: boolean) {
    this.streaming = active
    this.emit('StreamStateChanged', {
      outputActive: false,
      outputState: active
        ? 'OBS_WEBSOCKET_OUTPUT_STARTING'
        : 'OBS_WEBSOCKET_OUTPUT_STOPPING',
    })
    this.emit('StreamStateChanged', {
      outputActive: active,
      outputState: active
        ? 'OBS_WEBSOCKET_OUTPUT_STARTED'
        : 'OBS_WEBSOCKET_OUTPUT_STOPPED',
    })
  }

  setRecording(active: boolean) {
    this.recording = active
    this.emit('RecordStateChanged', {
      outputActive: active,
      outputState: active
        ? 'OBS_WEBSOCKET_OUTPUT_STARTED'
        : 'OBS_WEBSOCKET_OUTPUT_STOPPED',
    })
  }

  private accept(socket: WebSocket) {
    this.clients.add(socket)
    socket.on('close', () => this.clients.delete(socket))
    socket.on('message', (raw) => {
      const message = JSON.parse(String(raw)) as {
        op: number
        d: Record<string, unknown>
      }
      if (message.op === 1) {
        socket.send(JSON.stringify({ op: 2, d: { negotiatedRpcVersion: 1 } }))
      } else if (message.op === 6) {
        this.answer(socket, message.d)
      }
    })
    socket.send(
      JSON.stringify({
        op: 0,
        d: {
          obsStudioVersion: '31.0.0',
          obsWebSocketVersion: '5.5.0',
          rpcVersion: 1,
        },
      }),
    )
  }

  private answer(socket: WebSocket, request: Record<string, unknown>) {
    const data = (request.requestData ?? {}) as Record<string, unknown>
    let responseData: Record<string, unknown> = {}
    switch (request.requestType) {
      case 'GetCurrentProgramScene':
        responseData = { sceneName: this.scene }
        break
      case 'SetCurrentProgramScene':
        this.selectScene(String(data.sceneName))
        break
      case 'GetSceneList':
        responseData = { scenes: [{ sceneName: this.scene, sceneIndex: 0 }] }
        break
      case 'GetStreamStatus':
        responseData = { outputActive: this.streaming }
        break
      case 'GetRecordStatus':
        responseData = { outputActive: this.recording }
        break
    }
    socket.send(
      JSON.stringify({
        op: 7,
        d: {
          requestType: request.requestType,
          requestId: request.requestId,
          requestStatus: { result: true, code: 100 },
          responseData,
        },
      }),
    )
  }

  private emit(eventType: string, eventData: Record<string, unknown>) {
    const payload = JSON.stringify({ op: 5, d: { eventType, eventData } })
    for (const socket of this.clients) socket.send(payload)
  }
}
