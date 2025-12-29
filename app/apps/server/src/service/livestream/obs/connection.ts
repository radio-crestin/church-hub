import OBSWebSocket from 'obs-websocket-js'

import type { OBSConnectionStatus, OBSStreamingStatus } from '../types'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [obs] ${message}`)
}

class OBSConnectionManager {
  private obs: OBSWebSocket
  private connected = false
  private connecting = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 3000

  private host = '127.0.0.1'
  private port = 4455
  private password = ''

  private currentScene: string | null = null
  private isStreaming = false
  private isRecording = false

  private connectionStatusCallback:
    | ((status: OBSConnectionStatus) => void)
    | null = null
  private streamingStatusCallback:
    | ((status: OBSStreamingStatus) => void)
    | null = null
  private currentSceneCallback: ((sceneName: string) => void) | null = null
  private scenesListCallback: (() => void) | null = null

  constructor() {
    this.obs = new OBSWebSocket()
    this.setupEventListeners()
  }

  private setupEventListeners() {
    this.obs.on('ConnectionOpened', () => {
      log('info', 'Connection opened')
    })

    this.obs.on('ConnectionClosed', () => {
      log('info', 'Connection closed')
      this.handleDisconnect()
    })

    this.obs.on('ConnectionError', (error) => {
      log('error', `Connection error: ${error.message}`)
    })

    this.obs.on('Identified', () => {
      log('info', 'Identified successfully')
      this.connected = true
      this.connecting = false
      this.reconnectAttempts = 0
      this.notifyConnectionStatus()
      this.fetchInitialState()
    })

    this.obs.on('CurrentProgramSceneChanged', (data) => {
      log('debug', `Scene changed: ${data.sceneName}`)
      this.currentScene = data.sceneName
      if (this.currentSceneCallback) {
        this.currentSceneCallback(data.sceneName)
      }
    })

    this.obs.on('StreamStateChanged', (data) => {
      log('debug', `Stream state changed: ${data.outputState}`)
      this.isStreaming = data.outputActive
      this.notifyStreamingStatus()
    })

    this.obs.on('RecordStateChanged', (data) => {
      log('debug', `Record state changed: ${data.outputState}`)
      this.isRecording = data.outputActive
      this.notifyStreamingStatus()
    })

    this.obs.on('SceneListChanged', () => {
      log('debug', 'Scene list changed')
      if (this.scenesListCallback) {
        this.scenesListCallback()
      }
    })
  }

  private handleDisconnect() {
    const wasConnected = this.connected
    this.connected = false
    this.connecting = false
    this.currentScene = null
    this.isStreaming = false
    this.isRecording = false

    if (wasConnected) {
      this.notifyConnectionStatus()
      this.notifyStreamingStatus()
    }
  }

  private async fetchInitialState() {
    try {
      const sceneResponse = await this.obs.call('GetCurrentProgramScene')
      this.currentScene = sceneResponse.sceneName as string
      if (this.currentSceneCallback) {
        this.currentSceneCallback(this.currentScene)
      }

      const streamStatus = await this.obs.call('GetStreamStatus')
      this.isStreaming = streamStatus.outputActive

      const recordStatus = await this.obs.call('GetRecordStatus')
      this.isRecording = recordStatus.outputActive

      this.notifyStreamingStatus()

      if (this.scenesListCallback) {
        this.scenesListCallback()
      }
    } catch (error) {
      log('error', `Failed to fetch initial state: ${error}`)
    }
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

    try {
      const url = `ws://${this.host}:${this.port}`
      log('info', `Connecting to OBS at ${url}`)

      await this.obs.connect(url, this.password || undefined)
    } catch (error) {
      log('error', `Failed to connect: ${error}`)
      this.connecting = false
      this.notifyConnectionStatus()
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempts = this.maxReconnectAttempts

    if (this.connected) {
      await this.obs.disconnect()
    }
    this.handleDisconnect()
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

  setCurrentScene(sceneName: string): void {
    this.currentScene = sceneName
    if (this.currentSceneCallback) {
      this.currentSceneCallback(sceneName)
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  async getSceneList(): Promise<{ sceneName: string; sceneIndex: number }[]> {
    if (!this.connected) {
      throw new Error('Not connected to OBS')
    }

    const response = await this.obs.call('GetSceneList')
    return (
      response.scenes as { sceneName: string; sceneIndex: number }[]
    ).reverse()
  }

  async switchScene(sceneName: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to OBS')
    }

    await this.obs.call('SetCurrentProgramScene', { sceneName })
  }

  async startStreaming(): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to OBS')
    }

    await this.obs.call('StartStream')
  }

  async stopStreaming(): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to OBS')
    }

    await this.obs.call('StopStream')
  }

  async startRecording(): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to OBS')
    }

    await this.obs.call('StartRecord')
  }

  async stopRecording(): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to OBS')
    }

    await this.obs.call('StopRecord')
  }
}

export const obsConnection = new OBSConnectionManager()
