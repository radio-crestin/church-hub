import type { AddressInfo } from 'node:net'
import { type WebSocket, WebSocketServer } from 'ws'

/**
 * A local stand-in for OBS's WebSocket server (protocol v5, no password):
 * it greets, identifies and answers every request, and StartStream /
 * StopStream switch its stream on and off, so a spec can start and stop a
 * livestream without OBS. The other methods play what an operator does in
 * OBS itself, sending the events OBS sends.
 */
export interface MockObs {
  port: number
  close: () => Promise<void>
  /** The operator picks a scene in OBS. */
  selectScene: (sceneName: string) => void
  /** The stream goes live or ends, through OBS's in-between state. */
  setStreaming: (active: boolean) => void
  setRecording: (active: boolean) => void
}

interface MockObsOptions {
  /** Already streaming when Church Hub connects. */
  streaming?: boolean
}

const OP = {
  Hello: 0,
  Identify: 1,
  Identified: 2,
  Event: 5,
  Request: 6,
  RequestResponse: 7,
}

export async function startMockObs({
  streaming: streamingAtStart = false,
}: MockObsOptions = {}): Promise<MockObs> {
  let streaming = streamingAtStart
  let recording = false
  let scene = 'Live'
  const server = new WebSocketServer({
    host: '127.0.0.1',
    port: 0,
    handleProtocols: () => 'obswebsocket.json',
  })

  const send = (ws: WebSocket, op: number, d: unknown) =>
    ws.send(JSON.stringify({ op, d }))
  const emit = (eventType: string, eventData: Record<string, unknown>) => {
    for (const ws of server.clients)
      send(ws, OP.Event, { eventType, eventData })
  }
  const outputState = (active: boolean) =>
    active ? 'OBS_WEBSOCKET_OUTPUT_STARTED' : 'OBS_WEBSOCKET_OUTPUT_STOPPED'

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
        return { outputActive: recording }
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
            outputState: outputState(streaming),
          },
        })
      }
    })
  })

  await new Promise<void>((resolve) => server.once('listening', resolve))
  const { port } = server.address() as AddressInfo
  return {
    port,
    selectScene: (sceneName) => {
      scene = sceneName
      emit('CurrentProgramSceneChanged', { sceneName })
    },
    setStreaming: (active) => {
      streaming = active
      emit('StreamStateChanged', {
        outputActive: false,
        outputState: active
          ? 'OBS_WEBSOCKET_OUTPUT_STARTING'
          : 'OBS_WEBSOCKET_OUTPUT_STOPPING',
      })
      emit('StreamStateChanged', {
        outputActive: active,
        outputState: outputState(active),
      })
    },
    setRecording: (active) => {
      recording = active
      emit('RecordStateChanged', {
        outputActive: active,
        outputState: outputState(active),
      })
    },
    close: () =>
      new Promise((resolve) => {
        for (const client of server.clients) client.terminate()
        server.close(() => resolve())
      }),
  }
}
