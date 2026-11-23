import type { AddressInfo } from 'node:net'
import { type WebSocket, WebSocketServer } from 'ws'

/**
 * A local stand-in for OBS's WebSocket server (protocol v5, no password):
 * it greets, identifies and answers every request, and StartStream /
 * StopStream switch its stream on and off, so a spec can start and stop a
 * livestream without OBS.
 */
export interface MockObs {
  port: number
  close: () => Promise<void>
}

const OP = {
  Hello: 0,
  Identify: 1,
  Identified: 2,
  Event: 5,
  Request: 6,
  RequestResponse: 7,
}

export async function startMockObs(): Promise<MockObs> {
  let streaming = false
  let scene = 'Live'
  const server = new WebSocketServer({
    host: '127.0.0.1',
    port: 0,
    handleProtocols: () => 'obswebsocket.json',
  })

  const send = (ws: WebSocket, op: number, d: unknown) =>
    ws.send(JSON.stringify({ op, d }))

  const answer = (type: string, data: Record<string, unknown>) => {
    switch (type) {
      case 'GetCurrentProgramScene':
        return { sceneName: scene, currentProgramSceneName: scene }
      case 'SetCurrentProgramScene':
        scene = String(data.sceneName)
        return {}
      case 'GetSceneList':
        return { currentProgramSceneName: scene, scenes: [] }
      case 'GetStreamStatus':
        return { outputActive: streaming }
      case 'GetRecordStatus':
        return { outputActive: false }
      default:
        return {}
    }
  }

  server.on('connection', (ws) => {
    send(ws, OP.Hello, { obsWebSocketVersion: '5.5.0', rpcVersion: 1 })
    ws.on('message', (raw) => {
      const { op, d } = JSON.parse(raw.toString()) as {
        op: number
        d: Record<string, unknown>
      }
      if (op === OP.Identify) {
        send(ws, OP.Identified, { negotiatedRpcVersion: 1 })
        return
      }
      if (op !== OP.Request) return
      const type = String(d.requestType)
      const responseData = answer(
        type,
        (d.requestData ?? {}) as Record<string, unknown>,
      )
      send(ws, OP.RequestResponse, {
        requestType: type,
        requestId: d.requestId,
        requestStatus: { result: true, code: 100 },
        responseData,
      })
      if (type === 'StartStream' || type === 'StopStream') {
        streaming = type === 'StartStream'
        send(ws, OP.Event, {
          eventType: 'StreamStateChanged',
          eventIntent: 64,
          eventData: {
            outputActive: streaming,
            outputState: streaming
              ? 'OBS_WEBSOCKET_OUTPUT_STARTED'
              : 'OBS_WEBSOCKET_OUTPUT_STOPPED',
          },
        })
      }
    })
  })

  await new Promise<void>((resolve) => server.once('listening', resolve))
  const { port } = server.address() as AddressInfo
  return {
    port,
    close: () =>
      new Promise((resolve) => {
        for (const client of server.clients) client.terminate()
        server.close(() => resolve())
      }),
  }
}
