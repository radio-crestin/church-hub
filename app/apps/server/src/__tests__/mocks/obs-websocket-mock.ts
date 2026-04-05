/**
 * Mock OBS WebSocket server for integration testing.
 * Simulates OBS Studio's WebSocket API (v5 protocol) to allow
 * testing of OBS integration without a running OBS instance.
 */

interface OBSScene {
  sceneName: string
  sceneIndex: number
  sceneUuid: string
}

interface OBSState {
  scenes: OBSScene[]
  currentProgramScene: string
  currentPreviewScene: string | null
  streaming: boolean
  recording: boolean
  streamTimecode: string
  recordTimecode: string
}

const defaultScenes: OBSScene[] = [
  { sceneName: 'Main Camera', sceneIndex: 0, sceneUuid: 'scene-uuid-1' },
  { sceneName: 'Screen Share', sceneIndex: 1, sceneUuid: 'scene-uuid-2' },
  { sceneName: 'Starting Soon', sceneIndex: 2, sceneUuid: 'scene-uuid-3' },
  { sceneName: 'BRB', sceneIndex: 3, sceneUuid: 'scene-uuid-4' },
  { sceneName: 'Ending', sceneIndex: 4, sceneUuid: 'scene-uuid-5' },
]

export class OBSWebSocketMock {
  private server: ReturnType<typeof Bun.serve> | null = null
  private state: OBSState
  private clients: Set<unknown> = new Set()
  public port: number

  constructor(port = 4455) {
    this.port = port
    this.state = {
      scenes: [...defaultScenes],
      currentProgramScene: 'Main Camera',
      currentPreviewScene: null,
      streaming: false,
      recording: false,
      streamTimecode: '00:00:00.000',
      recordTimecode: '00:00:00.000',
    }
  }

  async start(): Promise<void> {
    this.server = Bun.serve({
      port: this.port,
      fetch(req, server) {
        if (server.upgrade(req)) return undefined as unknown as Response
        return new Response('OBS WebSocket Mock', { status: 200 })
      },
      websocket: {
        open: (ws) => {
          this.clients.add(ws)
          // Send Hello message (OBS WebSocket v5 protocol)
          ws.send(
            JSON.stringify({
              op: 0, // Hello
              d: {
                obsWebSocketVersion: '5.4.2',
                rpcVersion: 1,
                authentication: null,
              },
            }),
          )
        },
        message: (ws, msg) => {
          const data = JSON.parse(String(msg))
          this.handleMessage(ws, data)
        },
        close: (ws) => {
          this.clients.delete(ws)
        },
      },
    })
  }

  private handleMessage(
    ws: { send: (data: string) => void },
    data: { op: number; d: Record<string, unknown> },
  ): void {
    switch (data.op) {
      case 1: // Identify
        ws.send(
          JSON.stringify({
            op: 2, // Identified
            d: { negotiatedRpcVersion: 1 },
          }),
        )
        break

      case 6: // Request
        this.handleRequest(
          ws,
          data.d as {
            requestType: string
            requestId: string
            requestData?: Record<string, unknown>
          },
        )
        break
    }
  }

  private handleRequest(
    ws: { send: (data: string) => void },
    request: {
      requestType: string
      requestId: string
      requestData?: Record<string, unknown>
    },
  ): void {
    const { requestType, requestId, requestData } = request
    let responseData: Record<string, unknown> = {}
    let requestStatus = { result: true, code: 100 }

    switch (requestType) {
      case 'GetVersion':
        responseData = {
          obsVersion: '30.2.3',
          obsWebSocketVersion: '5.4.2',
          rpcVersion: 1,
          platform: 'macos',
        }
        break

      case 'GetSceneList':
        responseData = {
          currentProgramSceneName: this.state.currentProgramScene,
          currentProgramSceneUuid: this.state.scenes.find(
            (s) => s.sceneName === this.state.currentProgramScene,
          )?.sceneUuid,
          currentPreviewSceneName: this.state.currentPreviewScene,
          scenes: this.state.scenes.map((s) => ({
            sceneName: s.sceneName,
            sceneIndex: s.sceneIndex,
            sceneUuid: s.sceneUuid,
          })),
        }
        break

      case 'SetCurrentProgramScene': {
        const sceneName = requestData?.sceneName as string
        if (this.state.scenes.some((s) => s.sceneName === sceneName)) {
          this.state.currentProgramScene = sceneName
          this.broadcastEvent('CurrentProgramSceneChanged', {
            sceneName,
            sceneUuid: this.state.scenes.find((s) => s.sceneName === sceneName)
              ?.sceneUuid,
          })
        } else {
          requestStatus = { result: false, code: 600 }
        }
        break
      }

      case 'GetStreamStatus':
        responseData = {
          outputActive: this.state.streaming,
          outputReconnecting: false,
          outputTimecode: this.state.streamTimecode,
          outputDuration: 0,
          outputCongestion: 0,
          outputBytes: 0,
          outputSkippedFrames: 0,
          outputTotalFrames: 0,
        }
        break

      case 'StartStream':
        this.state.streaming = true
        this.broadcastEvent('StreamStateChanged', {
          outputActive: true,
          outputState: 'OBS_WEBSOCKET_OUTPUT_STARTED',
        })
        break

      case 'StopStream':
        this.state.streaming = false
        this.broadcastEvent('StreamStateChanged', {
          outputActive: false,
          outputState: 'OBS_WEBSOCKET_OUTPUT_STOPPED',
        })
        break

      case 'StartRecord':
        this.state.recording = true
        this.broadcastEvent('RecordStateChanged', {
          outputActive: true,
          outputState: 'OBS_WEBSOCKET_OUTPUT_STARTED',
        })
        break

      case 'StopRecord':
        this.state.recording = false
        this.broadcastEvent('RecordStateChanged', {
          outputActive: false,
          outputState: 'OBS_WEBSOCKET_OUTPUT_STOPPED',
          outputPath: '/tmp/recording.mp4',
        })
        break

      case 'GetRecordStatus':
        responseData = {
          outputActive: this.state.recording,
          outputPaused: false,
          outputTimecode: this.state.recordTimecode,
          outputDuration: 0,
          outputBytes: 0,
        }
        break

      default:
        requestStatus = { result: false, code: 204 } // Unknown request
    }

    ws.send(
      JSON.stringify({
        op: 7, // RequestResponse
        d: {
          requestType,
          requestId,
          requestStatus,
          responseData,
        },
      }),
    )
  }

  private broadcastEvent(
    eventType: string,
    eventData: Record<string, unknown>,
  ): void {
    const msg = JSON.stringify({
      op: 5, // Event
      d: {
        eventType,
        eventIntent: 0,
        eventData,
      },
    })
    for (const client of this.clients) {
      try {
        ;(client as { send: (data: string) => void }).send(msg)
      } catch {
        /* ignore closed connections */
      }
    }
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.stop(true)
      this.server = null
    }
    this.clients.clear()
  }

  /** Reset state to defaults */
  reset(): void {
    this.state = {
      scenes: [...defaultScenes],
      currentProgramScene: 'Main Camera',
      currentPreviewScene: null,
      streaming: false,
      recording: false,
      streamTimecode: '00:00:00.000',
      recordTimecode: '00:00:00.000',
    }
  }

  /** Set streaming state for testing */
  setStreaming(active: boolean): void {
    this.state.streaming = active
  }

  /** Set recording state for testing */
  setRecording(active: boolean): void {
    this.state.recording = active
  }

  /** Get current state for assertions */
  getState(): OBSState {
    return { ...this.state }
  }
}
