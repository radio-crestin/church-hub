/**
 * Mock Audio Server for integration testing.
 * Simulates the Tauri rodio audio HTTP API on port 3199
 * to allow testing of the music player service without a real audio backend.
 */

interface AudioServerState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  currentFile: string | null
}

interface RequestLog {
  method: string
  path: string
  body: unknown
  timestamp: number
}

export class AudioServerMock {
  private server: ReturnType<typeof Bun.serve> | null = null
  private state: AudioServerState
  public port: number
  public baseUrl: string
  private requestLog: RequestLog[] = []
  private playErrorMessage: string | null = null
  private seekErrorMessage: string | null = null

  constructor(port = 3199) {
    this.port = port
    this.baseUrl = `http://127.0.0.1:${port}`
    this.state = this.getDefaultState()
  }

  private getDefaultState(): AudioServerState {
    return {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 50,
      isMuted: false,
      currentFile: null,
    }
  }

  async start(): Promise<void> {
    if (this.server) return

    this.server = Bun.serve({
      port: this.port,
      fetch: async (req) => {
        const url = new URL(req.url)
        const path = url.pathname
        const method = req.method

        let body: unknown = null
        if (method === 'POST') {
          try {
            body = await req.json()
          } catch {
            body = null
          }
        }

        this.requestLog.push({
          method,
          path,
          body,
          timestamp: Date.now(),
        })

        return this.handleRequest(method, path, body)
      },
    })
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.stop(true)
      this.server = null
    }
  }

  reset(): void {
    this.state = this.getDefaultState()
    this.requestLog = []
    this.playErrorMessage = null
    this.seekErrorMessage = null
  }

  // State manipulation methods for tests
  setState(partial: Partial<AudioServerState>): void {
    this.state = { ...this.state, ...partial }
  }

  getState(): AudioServerState {
    return { ...this.state }
  }

  getRequestLog(): RequestLog[] {
    return [...this.requestLog]
  }

  getRequestsForPath(path: string): RequestLog[] {
    return this.requestLog.filter((r) => r.path === path)
  }

  clearRequestLog(): void {
    this.requestLog = []
  }

  /** Make the next /play request return an error */
  setPlayError(message: string | null): void {
    this.playErrorMessage = message
  }

  /** Make the next /seek request return an error */
  setSeekError(message: string | null): void {
    this.seekErrorMessage = message
  }

  private handleRequest(method: string, path: string, body: unknown): Response {
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })

    if (method === 'GET' && path === '/health') {
      return json({ ok: true })
    }

    if (method === 'GET' && path === '/state') {
      return json({
        is_playing: this.state.isPlaying,
        current_time: this.state.currentTime,
        duration: this.state.duration,
        volume: this.state.volume,
        is_muted: this.state.isMuted,
        current_file: this.state.currentFile,
      })
    }

    if (method === 'POST' && path === '/play') {
      if (this.playErrorMessage) {
        const msg = this.playErrorMessage
        this.playErrorMessage = null
        return json({ error: msg }, 500)
      }
      const { path: filePath } = body as { path: string }
      this.state.currentFile = filePath
      this.state.isPlaying = true
      this.state.currentTime = 0
      this.state.duration = 180 // Default 3 minutes
      return json({ ok: true })
    }

    if (method === 'POST' && path === '/pause') {
      this.state.isPlaying = false
      return json({ ok: true })
    }

    if (method === 'POST' && path === '/resume') {
      if (this.state.currentFile) {
        this.state.isPlaying = true
      }
      return json({ ok: true })
    }

    if (method === 'POST' && path === '/stop') {
      this.state.isPlaying = false
      this.state.currentTime = 0
      this.state.duration = 0
      this.state.currentFile = null
      return json({ ok: true })
    }

    if (method === 'POST' && path === '/seek') {
      if (this.seekErrorMessage) {
        const msg = this.seekErrorMessage
        this.seekErrorMessage = null
        return json({ error: msg }, 500)
      }
      const { time } = body as { time: number }
      this.state.currentTime = time
      return json({ ok: true })
    }

    if (method === 'POST' && path === '/volume') {
      const { level } = body as { level: number }
      this.state.volume = level
      return json({ ok: true })
    }

    if (method === 'POST' && path === '/mute') {
      const { muted } = body as { muted: boolean }
      this.state.isMuted = muted
      return json({ ok: true })
    }

    return json({ error: 'Not found' }, 404)
  }
}
