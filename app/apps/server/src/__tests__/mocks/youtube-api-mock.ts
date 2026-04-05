/**
 * Mock YouTube Live API server for integration testing.
 * Simulates YouTube Data API v3 live streaming endpoints to allow
 * testing of YouTube integration without real Google credentials.
 */

interface MockBroadcast {
  id: string
  snippet: {
    title: string
    description: string
    scheduledStartTime: string
    actualStartTime?: string
    actualEndTime?: string
    liveChatId: string
    thumbnails: Record<string, { url: string; width: number; height: number }>
  }
  status: {
    lifeCycleStatus:
      | 'created'
      | 'ready'
      | 'testing'
      | 'live'
      | 'complete'
      | 'revoked'
    privacyStatus: 'public' | 'private' | 'unlisted'
    recordingStatus: 'notRecording' | 'recording' | 'recorded'
    madeForKids: boolean
  }
  contentDetails: {
    boundStreamId?: string
    monitorStream: { enableMonitorStream: boolean }
    enableAutoStart: boolean
    enableAutoStop: boolean
  }
}

interface MockStream {
  id: string
  snippet: {
    title: string
  }
  cdn: {
    ingestionInfo: {
      streamName: string
      ingestionAddress: string
      backupIngestionAddress: string
    }
    resolution: string
    frameRate: string
  }
  status: {
    streamStatus: 'created' | 'ready' | 'active' | 'inactive' | 'error'
    healthStatus: { status: string }
  }
}

interface YouTubeMockState {
  authenticated: boolean
  accessToken: string
  refreshToken: string
  broadcasts: MockBroadcast[]
  streams: MockStream[]
  tokenExpiry: Date
}

export class YouTubeAPIMock {
  private server: ReturnType<typeof Bun.serve> | null = null
  private state: YouTubeMockState
  public port: number
  public baseUrl: string

  constructor(port = 9443) {
    this.port = port
    this.baseUrl = `http://localhost:${port}`
    this.state = this.getDefaultState()
  }

  private getDefaultState(): YouTubeMockState {
    return {
      authenticated: true,
      accessToken: 'mock-access-token-12345',
      refreshToken: 'mock-refresh-token-12345',
      broadcasts: [
        {
          id: 'broadcast-1',
          snippet: {
            title: 'Sunday Service',
            description: 'Weekly church service livestream',
            scheduledStartTime: new Date().toISOString(),
            liveChatId: 'chat-1',
            thumbnails: {
              default: {
                url: 'https://example.com/thumb.jpg',
                width: 120,
                height: 90,
              },
            },
          },
          status: {
            lifeCycleStatus: 'ready',
            privacyStatus: 'public',
            recordingStatus: 'notRecording',
            madeForKids: false,
          },
          contentDetails: {
            boundStreamId: 'stream-1',
            monitorStream: { enableMonitorStream: false },
            enableAutoStart: true,
            enableAutoStop: true,
          },
        },
      ],
      streams: [
        {
          id: 'stream-1',
          snippet: { title: 'Church Stream Key' },
          cdn: {
            ingestionInfo: {
              streamName: 'mock-stream-key-abcd',
              ingestionAddress: 'rtmp://a.rtmp.youtube.com/live2',
              backupIngestionAddress: 'rtmp://b.rtmp.youtube.com/live2',
            },
            resolution: '1080p',
            frameRate: '30fps',
          },
          status: {
            streamStatus: 'ready',
            healthStatus: { status: 'good' },
          },
        },
      ],
      tokenExpiry: new Date(Date.now() + 3600000),
    }
  }

  async start(): Promise<void> {
    this.server = Bun.serve({
      port: this.port,
      fetch: (req) => this.handleRequest(req),
    })
  }

  private handleRequest(req: Request): Response {
    const url = new URL(req.url)
    const path = url.pathname

    // OAuth token endpoint
    if (path === '/oauth2/v4/token' || path === '/token') {
      return this.handleTokenRequest(req)
    }

    // OAuth revoke endpoint
    if (path === '/o/oauth2/revoke') {
      this.state.authenticated = false
      return Response.json({ success: true })
    }

    // YouTube API routes
    if (path.startsWith('/youtube/v3/')) {
      if (!this.state.authenticated) {
        return Response.json(
          { error: { code: 401, message: 'Unauthorized' } },
          { status: 401 },
        )
      }
      return this.handleYouTubeApi(req, path.replace('/youtube/v3/', ''))
    }

    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  private handleTokenRequest(_req: Request): Response {
    if (!this.state.authenticated) {
      return Response.json(
        { error: 'invalid_grant', error_description: 'Token revoked' },
        { status: 400 },
      )
    }

    // Refresh token or exchange code
    this.state.accessToken = `mock-access-token-${Date.now()}`
    this.state.tokenExpiry = new Date(Date.now() + 3600000)

    return Response.json({
      access_token: this.state.accessToken,
      refresh_token: this.state.refreshToken,
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/youtube',
    })
  }

  private handleYouTubeApi(req: Request, apiPath: string): Response {
    const url = new URL(req.url)
    const method = req.method

    // Live Broadcasts
    if (apiPath === 'liveBroadcasts') {
      if (method === 'GET') {
        const broadcastStatus = url.searchParams.get('broadcastStatus')
        let broadcasts = this.state.broadcasts

        if (broadcastStatus === 'upcoming') {
          broadcasts = broadcasts.filter(
            (b) =>
              b.status.lifeCycleStatus === 'created' ||
              b.status.lifeCycleStatus === 'ready',
          )
        } else if (broadcastStatus === 'active') {
          broadcasts = broadcasts.filter(
            (b) =>
              b.status.lifeCycleStatus === 'live' ||
              b.status.lifeCycleStatus === 'testing',
          )
        } else if (broadcastStatus === 'completed') {
          broadcasts = broadcasts.filter(
            (b) => b.status.lifeCycleStatus === 'complete',
          )
        }

        return Response.json({
          kind: 'youtube#liveBroadcastListResponse',
          items: broadcasts,
          pageInfo: {
            totalResults: broadcasts.length,
            resultsPerPage: 50,
          },
        })
      }

      if (method === 'POST') {
        const newBroadcast: MockBroadcast = {
          id: `broadcast-${Date.now()}`,
          snippet: {
            title: 'New Broadcast',
            description: '',
            scheduledStartTime: new Date().toISOString(),
            liveChatId: `chat-${Date.now()}`,
            thumbnails: {},
          },
          status: {
            lifeCycleStatus: 'created',
            privacyStatus: 'public',
            recordingStatus: 'notRecording',
            madeForKids: false,
          },
          contentDetails: {
            monitorStream: { enableMonitorStream: false },
            enableAutoStart: true,
            enableAutoStop: true,
          },
        }
        this.state.broadcasts.push(newBroadcast)
        return Response.json(newBroadcast)
      }

      if (method === 'DELETE') {
        const id = url.searchParams.get('id')
        this.state.broadcasts = this.state.broadcasts.filter((b) => b.id !== id)
        return new Response(null, { status: 204 })
      }
    }

    // Live Broadcast Transition
    if (apiPath === 'liveBroadcasts/transition') {
      const id = url.searchParams.get('id')
      const broadcastStatus = url.searchParams.get('broadcastStatus')
      const broadcast = this.state.broadcasts.find((b) => b.id === id)

      if (broadcast && broadcastStatus) {
        broadcast.status.lifeCycleStatus =
          broadcastStatus as MockBroadcast['status']['lifeCycleStatus']
        if (broadcastStatus === 'live') {
          broadcast.snippet.actualStartTime = new Date().toISOString()
        }
        if (broadcastStatus === 'complete') {
          broadcast.snippet.actualEndTime = new Date().toISOString()
        }
        return Response.json(broadcast)
      }

      return Response.json(
        { error: { code: 404, message: 'Broadcast not found' } },
        { status: 404 },
      )
    }

    // Live Streams
    if (apiPath === 'liveStreams') {
      return Response.json({
        kind: 'youtube#liveStreamListResponse',
        items: this.state.streams,
        pageInfo: {
          totalResults: this.state.streams.length,
          resultsPerPage: 50,
        },
      })
    }

    // Live Broadcast Bind
    if (apiPath === 'liveBroadcasts/bind') {
      const id = url.searchParams.get('id')
      const streamId = url.searchParams.get('streamId')
      const broadcast = this.state.broadcasts.find((b) => b.id === id)

      if (broadcast && streamId) {
        broadcast.contentDetails.boundStreamId = streamId
        return Response.json(broadcast)
      }
    }

    return Response.json({ error: 'Not implemented' }, { status: 501 })
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.stop(true)
      this.server = null
    }
  }

  /** Reset state to defaults */
  reset(): void {
    this.state = this.getDefaultState()
  }

  /** Set auth state for testing */
  setAuthenticated(authenticated: boolean): void {
    this.state.authenticated = authenticated
  }

  /** Get current state for assertions */
  getState(): YouTubeMockState {
    return { ...this.state }
  }

  /** Add a broadcast for testing */
  addBroadcast(broadcast: Partial<MockBroadcast>): MockBroadcast {
    const full: MockBroadcast = {
      id: broadcast.id ?? `broadcast-${Date.now()}`,
      snippet: {
        title: 'Test Broadcast',
        description: '',
        scheduledStartTime: new Date().toISOString(),
        liveChatId: 'chat-test',
        thumbnails: {},
        ...broadcast.snippet,
      },
      status: {
        lifeCycleStatus: 'ready',
        privacyStatus: 'public',
        recordingStatus: 'notRecording',
        madeForKids: false,
        ...broadcast.status,
      },
      contentDetails: {
        monitorStream: { enableMonitorStream: false },
        enableAutoStart: true,
        enableAutoStop: true,
        ...broadcast.contentDetails,
      },
    }
    this.state.broadcasts.push(full)
    return full
  }
}
