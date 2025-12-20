import { createHash } from 'node:crypto'

import type { OBSConnectionStatus, OBSStreamingStatus } from '../types'

const DEBUG = process.env.DEBUG === 'true'
const OBS_LOG = process.env.OBS_LOG !== 'false' // Always log OBS messages unless explicitly disabled

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // For OBS connection debugging, log all non-debug messages by default
  if (level !== 'debug' && !OBS_LOG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [obs] ${message}`)
}

interface OBSMessage {
  op: number
  d: Record<string, unknown>
}

interface HelloData {
  obsStudioVersion: string
  obsWebSocketVersion: string
  rpcVersion: number
  authentication?: {
    challenge: string
    salt: string
  }
}

interface IdentifiedData {
  negotiatedRpcVersion: number
}

// OBS WebSocket opcodes
const OP = {
  Hello: 0,
  Identify: 1,
  Identified: 2,
  Reidentify: 3,
  Event: 5,
  Request: 6,
  RequestResponse: 7,
  RequestBatch: 8,
  RequestBatchResponse: 9,
} as const

// Event subscriptions
const EVENT_SUBSCRIPTION = {
  None: 0,
  General: 1 << 0,
  Config: 1 << 1,
  Scenes: 1 << 2,
  Inputs: 1 << 3,
  Transitions: 1 << 4,
  Filters: 1 << 5,
  Outputs: 1 << 6,
  SceneItems: 1 << 7,
  MediaInputs: 1 << 8,
  Vendors: 1 << 9,
  Ui: 1 << 10,
  All:
    (1 << 0) |
    (1 << 1) |
    (1 << 2) |
    (1 << 3) |
    (1 << 4) |
    (1 << 5) |
    (1 << 6) |
    (1 << 7) |
    (1 << 8) |
    (1 << 9) |
    (1 << 10),
}

function generateAuthString(
  password: string,
  salt: string,
  challenge: string,
): string {
  const secret = createHash('sha256')
    .update(password + salt)
    .digest('base64')

  return createHash('sha256')
    .update(secret + challenge)
    .digest('base64')
}

export class OBSWebSocketClient {
  private ws: WebSocket | null = null
  private connected = false
  private connecting = false
  private identified = false

  private host = '127.0.0.1'
  private port = 4455
  private password = ''

  private currentScene: string | null = null
  private isStreaming = false
  private isRecording = false

  private requestId = 0
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void
      reject: (error: Error) => void
    }
  >()

  private connectionStatusCallback:
    | ((status: OBSConnectionStatus) => void)
    | null = null
  private streamingStatusCallback:
    | ((status: OBSStreamingStatus) => void)
    | null = null
  private currentSceneCallback: ((sceneName: string) => void) | null = null
  private scenesListCallback: (() => void) | null = null

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 3000
  private autoReconnectEnabled = false

  enableAutoReconnect(enabled = true) {
    this.autoReconnectEnabled = enabled
    log('info', `Auto-reconnect ${enabled ? 'enabled' : 'disabled'}`)
  }

  isAutoReconnectEnabled(): boolean {
    return this.autoReconnectEnabled
  }

  private scheduleReconnect() {
    if (!this.autoReconnectEnabled) {
      log('debug', 'Auto-reconnect disabled, not scheduling reconnect')
      return
    }

    // Prevent duplicate scheduling
    if (this.reconnectTimer) {
      log('debug', 'Reconnect already scheduled, skipping')
      return
    }

    // Already connected or connecting
    if (this.connected || this.connecting) {
      log('debug', 'Already connected or connecting, skipping reconnect')
      return
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      log(
        'info',
        `Max reconnect attempts (${this.maxReconnectAttempts}) reached, waiting 30s before retrying...`,
      )
      this.reconnectAttempts = 0
      // Reset after a longer delay to try again (keep trying forever)
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null
        log('info', 'Resetting reconnect attempts and trying again...')
        this.scheduleReconnect()
      }, 30000)
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5)
    log(
      'info',
      `Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`,
    )

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      try {
        await this.connect()
      } catch (error) {
        log('error', `Reconnect attempt failed: ${error}`)
        // Error handlers will schedule another reconnect
      }
    }, delay)
  }

  setConnectionStatusCallback(callback: (status: OBSConnectionStatus) => void) {
    this.connectionStatusCallback = callback
  }

  setStreamingStatusCallback(callback: (status: OBSStreamingStatus) => void) {
    this.streamingStatusCallback = callback
  }

  setCurrentSceneCallback(callback: (sceneName: string) => void) {
    this.currentSceneCallback = callback
  }

  setScenesListCallback(callback: () => void) {
    this.scenesListCallback = callback
  }

  private notifyConnectionStatus() {
    if (this.connectionStatusCallback) {
      this.connectionStatusCallback(this.getConnectionStatus())
    }
  }

  private notifyStreamingStatus() {
    if (this.streamingStatusCallback) {
      this.streamingStatusCallback(this.getStreamingStatus())
    }
  }

  async connect(
    host?: string,
    port?: number,
    password?: string,
  ): Promise<void> {
    if (this.connected || this.connecting) {
      log('debug', 'Already connected or connecting')
      return
    }

    if (host) this.host = host
    if (port) this.port = port
    if (password !== undefined) this.password = password

    this.connecting = true
    this.notifyConnectionStatus()

    return new Promise((resolve, reject) => {
      const url = `ws://${this.host}:${this.port}`
      log(
        'info',
        `Connecting to OBS at ${url} with password: ${this.password ? 'yes' : 'no'}`,
      )

      // Connection timeout
      const timeout = setTimeout(() => {
        log('error', 'Connection timeout after 10 seconds')
        this.connecting = false
        this.ws?.close()
        reject(new Error('Connection timeout - OBS did not respond'))
      }, 10000)

      const cleanup = () => clearTimeout(timeout)

      try {
        log('info', 'Creating WebSocket connection...')
        this.ws = new WebSocket(url, ['obswebsocket.json'])
        log(
          'info',
          `WebSocket created, readyState: ${this.ws.readyState} (0=CONNECTING, 1=OPEN)`,
        )

        this.ws.onopen = () => {
          log('info', 'WebSocket connection opened, waiting for Hello...')
          log(
            'info',
            `WebSocket protocol: ${this.ws?.protocol || 'none'}, readyState: ${this.ws?.readyState}`,
          )
        }

        this.ws.onmessage = async (event) => {
          try {
            log(
              'info',
              `Received message: ${(event.data as string).substring(0, 100)}...`,
            )
            const message = JSON.parse(event.data as string) as OBSMessage
            await this.handleMessage(
              message,
              () => {
                cleanup()
                resolve()
              },
              (err) => {
                cleanup()
                reject(err)
              },
            )
          } catch (error) {
            log('error', `Failed to parse message: ${error}`)
            cleanup()
            reject(error as Error)
          }
        }

        this.ws.onerror = (event) => {
          const errorInfo =
            event instanceof ErrorEvent
              ? `${event.message} (type: ${event.type})`
              : `Unknown error (type: ${event?.type || 'none'})`
          log('error', `WebSocket error: ${errorInfo}`)
          cleanup()
          this.connecting = false
          this.notifyConnectionStatus()
          // Schedule reconnect on error if auto-reconnect is enabled
          this.scheduleReconnect()
          reject(new Error(`WebSocket connection error: ${errorInfo}`))
        }

        this.ws.onclose = (event) => {
          log(
            'info',
            `WebSocket connection closed (code: ${event.code}, reason: ${event.reason || 'none'})`,
          )
          cleanup()
          this.handleDisconnect()
          if (this.connecting) {
            reject(new Error('Connection closed before identification'))
          }
        }
      } catch (error) {
        this.connecting = false
        this.notifyConnectionStatus()
        // Schedule reconnect on error if auto-reconnect is enabled
        this.scheduleReconnect()
        reject(error)
      }
    })
  }

  private async handleMessage(
    message: OBSMessage,
    connectResolve?: (value: void) => void,
    connectReject?: (error: Error) => void,
  ): Promise<void> {
    switch (message.op) {
      case OP.Hello: {
        const data = message.d as HelloData
        log(
          'info',
          `Received Hello from OBS ${data.obsStudioVersion}, auth required: ${!!data.authentication}`,
        )
        await this.sendIdentify(data, connectReject)
        break
      }

      case OP.Identified: {
        const data = message.d as IdentifiedData
        log('info', `Identified with RPC version ${data.negotiatedRpcVersion}`)
        this.connected = true
        this.connecting = false
        this.identified = true
        this.reconnectAttempts = 0
        this.notifyConnectionStatus()
        // Resolve connection immediately, fetch initial state in background
        connectResolve?.()
        // Fetch initial state without blocking
        this.fetchInitialState().catch((err) => {
          log('error', `Failed to fetch initial state: ${err}`)
        })
        break
      }

      case OP.Event: {
        await this.handleEvent(message.d)
        break
      }

      case OP.RequestResponse: {
        const requestId = message.d.requestId as string
        const pending = this.pendingRequests.get(requestId)
        if (pending) {
          this.pendingRequests.delete(requestId)
          if (
            message.d.requestStatus &&
            (message.d.requestStatus as { result: boolean }).result
          ) {
            pending.resolve(message.d.responseData)
          } else {
            pending.reject(
              new Error(
                (message.d.requestStatus as { comment?: string })?.comment ||
                  'Request failed',
              ),
            )
          }
        }
        break
      }
    }
  }

  private async sendIdentify(
    hello: HelloData,
    reject?: (error: Error) => void,
  ): Promise<void> {
    const identifyData: Record<string, unknown> = {
      rpcVersion: 1,
      eventSubscriptions: EVENT_SUBSCRIPTION.All,
    }

    if (hello.authentication) {
      if (!this.password) {
        log('error', 'OBS requires authentication but no password configured')
        reject?.(
          new Error(
            'OBS requires authentication. Please set a password in OBS WebSocket settings.',
          ),
        )
        this.ws?.close()
        return
      }

      log('info', 'Generating authentication response...')
      identifyData.authentication = generateAuthString(
        this.password,
        hello.authentication.salt,
        hello.authentication.challenge,
      )
    }

    log('info', 'Sending Identify message...')
    this.send({ op: OP.Identify, d: identifyData })
  }

  private async handleEvent(data: Record<string, unknown>): Promise<void> {
    const eventType = data.eventType as string
    const eventData = data.eventData as Record<string, unknown> | undefined

    log('debug', `Event: ${eventType}`)

    switch (eventType) {
      case 'CurrentProgramSceneChanged':
        this.currentScene = eventData?.sceneName as string
        if (this.currentSceneCallback) {
          this.currentSceneCallback(this.currentScene)
        }
        break

      case 'StreamStateChanged':
        this.isStreaming = eventData?.outputActive as boolean
        this.notifyStreamingStatus()
        break

      case 'RecordStateChanged':
        this.isRecording = eventData?.outputActive as boolean
        this.notifyStreamingStatus()
        break

      case 'SceneListChanged':
        if (this.scenesListCallback) {
          this.scenesListCallback()
        }
        break
    }
  }

  private async fetchInitialState(): Promise<void> {
    log('info', 'Fetching initial OBS state...')
    try {
      log('info', 'Getting current program scene...')
      const sceneResponse = (await this.call('GetCurrentProgramScene')) as {
        sceneName: string
      }
      this.currentScene = sceneResponse.sceneName
      log('info', `Current scene: ${this.currentScene}`)
      if (this.currentSceneCallback) {
        this.currentSceneCallback(this.currentScene)
      }

      log('info', 'Getting stream status...')
      const streamStatus = (await this.call('GetStreamStatus')) as {
        outputActive: boolean
      }
      this.isStreaming = streamStatus.outputActive

      log('info', 'Getting record status...')
      const recordStatus = (await this.call('GetRecordStatus')) as {
        outputActive: boolean
      }
      this.isRecording = recordStatus.outputActive

      log(
        'info',
        `Initial state: streaming=${this.isStreaming}, recording=${this.isRecording}`,
      )
      this.notifyStreamingStatus()

      if (this.scenesListCallback) {
        this.scenesListCallback()
      }
    } catch (error) {
      log('error', `Failed to fetch initial state: ${error}`)
    }
  }

  private handleDisconnect(): void {
    const wasConnected = this.connected
    this.connected = false
    this.connecting = false
    this.identified = false
    this.currentScene = null
    this.isStreaming = false
    this.isRecording = false
    this.ws = null

    // Reject all pending requests
    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error('Connection closed'))
    }
    this.pendingRequests.clear()

    if (wasConnected) {
      this.notifyConnectionStatus()
      this.notifyStreamingStatus()
    }

    // Schedule reconnect if auto-reconnect is enabled
    this.scheduleReconnect()
  }

  async disconnect(): Promise<void> {
    // Disable auto-reconnect when manually disconnecting
    this.autoReconnectEnabled = false

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempts = 0

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    // Call handleDisconnect but it won't reconnect since autoReconnectEnabled is false
    const wasConnected = this.connected
    this.connected = false
    this.connecting = false
    this.identified = false
    this.currentScene = null
    this.isStreaming = false
    this.isRecording = false

    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error('Connection closed'))
    }
    this.pendingRequests.clear()

    if (wasConnected) {
      this.notifyConnectionStatus()
      this.notifyStreamingStatus()
    }
  }

  private send(message: OBSMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      log(
        'error',
        `Cannot send - ws: ${!!this.ws}, readyState: ${this.ws?.readyState}`,
      )
      throw new Error('Not connected to OBS')
    }
    const payload = JSON.stringify(message)
    log('info', `Sending message: ${payload.substring(0, 100)}...`)
    this.ws.send(payload)
  }

  async call<T = unknown>(
    requestType: string,
    requestData?: Record<string, unknown>,
  ): Promise<T> {
    if (!this.identified) {
      throw new Error('Not connected to OBS')
    }

    const requestId = `req-${++this.requestId}`

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
      })

      this.send({
        op: OP.Request,
        d: {
          requestType,
          requestId,
          requestData,
        },
      })

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId)
          reject(new Error(`Request ${requestType} timed out`))
        }
      }, 30000)
    })
  }

  getConnectionStatus(): OBSConnectionStatus {
    return {
      connected: this.connected,
      host: this.host,
      port: this.port,
      updatedAt: Date.now(),
    }
  }

  getStreamingStatus(): OBSStreamingStatus {
    return {
      isStreaming: this.isStreaming,
      isRecording: this.isRecording,
      updatedAt: Date.now(),
    }
  }

  getCurrentScene(): string | null {
    return this.currentScene
  }

  isConnected(): boolean {
    return this.connected
  }

  async getSceneList(): Promise<{ sceneName: string; sceneIndex: number }[]> {
    const response = await this.call<{
      scenes: { sceneName: string; sceneIndex: number }[]
    }>('GetSceneList')
    return response.scenes.reverse()
  }

  async switchScene(sceneName: string): Promise<void> {
    await this.call('SetCurrentProgramScene', { sceneName })
  }

  async startStreaming(): Promise<void> {
    await this.call('StartStream')
  }

  async stopStreaming(): Promise<void> {
    await this.call('StopStream')
  }

  async startRecording(): Promise<void> {
    await this.call('StartRecord')
  }

  async stopRecording(): Promise<void> {
    await this.call('StopRecord')
  }
}

export const obsConnection = new OBSWebSocketClient()
