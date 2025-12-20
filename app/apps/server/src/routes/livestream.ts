import { generateBroadcastMessage } from '../service/livestream/message'
import {
  getOBSConfig,
  getScenes,
  getVisibleScenes,
  obsConnection,
  reorderScenes,
  startStreaming,
  stopStreaming,
  switchScene,
  updateOBSConfig,
  updateScene,
} from '../service/livestream/obs'
import type { OBSConfig, YouTubeConfig } from '../service/livestream/types'
import {
  createBroadcast,
  endBroadcast,
  getActiveBroadcast,
  getAuthStatus,
  getAuthUrl,
  getStreamKeys,
  getYouTubeConfig,
  handleCallback,
  logout,
  updateYouTubeConfig,
} from '../service/livestream/youtube'
import {
  broadcastLivestreamStatus,
  broadcastOBSConnectionStatus,
  broadcastOBSCurrentScene,
  broadcastOBSStreamingStatus,
} from '../websocket'

type HandleCors = (req: Request, res: Response) => Response

export async function handleLivestreamRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
): Promise<Response | null> {
  // YouTube OAuth endpoints
  // GET /api/livestream/youtube/auth-url
  if (
    req.method === 'GET' &&
    url.pathname === '/api/livestream/youtube/auth-url'
  ) {
    try {
      const authUrl = getAuthUrl()
      return handleCors(
        req,
        new Response(JSON.stringify({ data: { url: authUrl } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch (error) {
      return handleCors(
        req,
        new Response(
          JSON.stringify({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to generate auth URL',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }
  }

  // GET /api/livestream/youtube/callback
  if (
    req.method === 'GET' &&
    url.pathname === '/api/livestream/youtube/callback'
  ) {
    const code = url.searchParams.get('code')
    if (!code) {
      return handleCors(
        req,
        new Response(
          `<!DOCTYPE html>
          <html>
          <body>
            <script>
              window.opener?.postMessage({ type: 'youtube-auth-error', error: 'No authorization code received' }, '*');
              window.close();
            </script>
            <p>Authorization failed. You can close this window.</p>
          </body>
          </html>`,
          { headers: { 'Content-Type': 'text/html' } },
        ),
      )
    }

    try {
      const status = await handleCallback(code)
      return handleCors(
        req,
        new Response(
          `<!DOCTYPE html>
          <html>
          <body>
            <script>
              window.opener?.postMessage({
                type: 'youtube-auth-success',
                channelName: '${status.channelName || ''}',
                channelId: '${status.channelId || ''}'
              }, '*');
              window.close();
            </script>
            <p>Authorization successful! You can close this window.</p>
          </body>
          </html>`,
          { headers: { 'Content-Type': 'text/html' } },
        ),
      )
    } catch (error) {
      return handleCors(
        req,
        new Response(
          `<!DOCTYPE html>
          <html>
          <body>
            <script>
              window.opener?.postMessage({ type: 'youtube-auth-error', error: '${error instanceof Error ? error.message : 'Authentication failed'}' }, '*');
              window.close();
            </script>
            <p>Authorization failed. You can close this window.</p>
          </body>
          </html>`,
          { headers: { 'Content-Type': 'text/html' } },
        ),
      )
    }
  }

  // GET /api/livestream/youtube/status
  if (
    req.method === 'GET' &&
    url.pathname === '/api/livestream/youtube/status'
  ) {
    const status = await getAuthStatus()
    return handleCors(
      req,
      new Response(JSON.stringify({ data: status }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // DELETE /api/livestream/youtube/logout
  if (
    req.method === 'DELETE' &&
    url.pathname === '/api/livestream/youtube/logout'
  ) {
    await logout()
    return handleCors(
      req,
      new Response(JSON.stringify({ data: { success: true } }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // YouTube Broadcast endpoints
  // POST /api/livestream/youtube/broadcast
  if (
    req.method === 'POST' &&
    url.pathname === '/api/livestream/youtube/broadcast'
  ) {
    try {
      const broadcast = await createBroadcast()
      return handleCors(
        req,
        new Response(JSON.stringify({ data: broadcast }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch (error) {
      return handleCors(
        req,
        new Response(
          JSON.stringify({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to create broadcast',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }
  }

  // GET /api/livestream/youtube/broadcast/active
  if (
    req.method === 'GET' &&
    url.pathname === '/api/livestream/youtube/broadcast/active'
  ) {
    const broadcast = await getActiveBroadcast()
    return handleCors(
      req,
      new Response(JSON.stringify({ data: broadcast }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // PUT /api/livestream/youtube/broadcast/:id/end
  const endBroadcastMatch = url.pathname.match(
    /^\/api\/livestream\/youtube\/broadcast\/([^/]+)\/end$/,
  )
  if (req.method === 'PUT' && endBroadcastMatch?.[1]) {
    try {
      await endBroadcast(endBroadcastMatch[1])
      broadcastLivestreamStatus({
        isLive: false,
        broadcastId: null,
        broadcastUrl: null,
        title: null,
        startedAt: null,
        updatedAt: Date.now(),
      })
      return handleCors(
        req,
        new Response(JSON.stringify({ data: { success: true } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch (error) {
      return handleCors(
        req,
        new Response(
          JSON.stringify({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to end broadcast',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }
  }

  // GET /api/livestream/youtube/streams
  if (
    req.method === 'GET' &&
    url.pathname === '/api/livestream/youtube/streams'
  ) {
    try {
      const streams = await getStreamKeys()
      return handleCors(
        req,
        new Response(JSON.stringify({ data: streams }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch (error) {
      return handleCors(
        req,
        new Response(
          JSON.stringify({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to get stream keys',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }
  }

  // YouTube Config endpoints
  // GET /api/livestream/youtube/config
  if (
    req.method === 'GET' &&
    url.pathname === '/api/livestream/youtube/config'
  ) {
    const config = await getYouTubeConfig()
    return handleCors(
      req,
      new Response(JSON.stringify({ data: config }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // PUT /api/livestream/youtube/config
  if (
    req.method === 'PUT' &&
    url.pathname === '/api/livestream/youtube/config'
  ) {
    try {
      const body = (await req.json()) as Partial<YouTubeConfig>
      const config = await updateYouTubeConfig(body)
      return handleCors(
        req,
        new Response(JSON.stringify({ data: config }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch {
      return handleCors(
        req,
        new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
  }

  // OBS endpoints
  // GET /api/livestream/obs/status
  if (req.method === 'GET' && url.pathname === '/api/livestream/obs/status') {
    const status = obsConnection.getConnectionStatus()
    const streaming = obsConnection.getStreamingStatus()
    return handleCors(
      req,
      new Response(JSON.stringify({ data: { ...status, ...streaming } }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // POST /api/livestream/obs/connect
  if (req.method === 'POST' && url.pathname === '/api/livestream/obs/connect') {
    try {
      const config = await getOBSConfig()
      await obsConnection.connect(config.host, config.port, config.password)
      const status = obsConnection.getConnectionStatus()
      broadcastOBSConnectionStatus(status)
      return handleCors(
        req,
        new Response(JSON.stringify({ data: status }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      let userFriendlyMessage = 'Failed to connect to OBS'

      if (
        errorMessage.includes('no subprotocol') ||
        errorMessage.includes('ECONNREFUSED')
      ) {
        userFriendlyMessage =
          'Cannot connect to OBS. Make sure OBS is running and WebSocket server is enabled (Tools → WebSocket Server Settings).'
      } else if (errorMessage.includes('Authentication')) {
        userFriendlyMessage =
          'OBS authentication failed. Check your WebSocket password in OBS settings.'
      } else if (
        errorMessage.includes('timeout') ||
        errorMessage.includes('ETIMEDOUT')
      ) {
        userFriendlyMessage =
          'Connection to OBS timed out. Check that the host and port are correct.'
      }

      return handleCors(
        req,
        new Response(
          JSON.stringify({
            error: userFriendlyMessage,
            details: errorMessage,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }
  }

  // POST /api/livestream/obs/disconnect
  if (
    req.method === 'POST' &&
    url.pathname === '/api/livestream/obs/disconnect'
  ) {
    await obsConnection.disconnect()
    const status = obsConnection.getConnectionStatus()
    broadcastOBSConnectionStatus(status)
    return handleCors(
      req,
      new Response(JSON.stringify({ data: status }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // GET /api/livestream/obs/scenes
  if (req.method === 'GET' && url.pathname === '/api/livestream/obs/scenes') {
    const visibleOnly = url.searchParams.get('visible') === 'true'
    const scenes = visibleOnly ? await getVisibleScenes() : await getScenes()
    return handleCors(
      req,
      new Response(JSON.stringify({ data: scenes }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // PUT /api/livestream/obs/scenes/:id
  const updateSceneMatch = url.pathname.match(
    /^\/api\/livestream\/obs\/scenes\/(\d+)$/,
  )
  if (req.method === 'PUT' && updateSceneMatch?.[1]) {
    try {
      const id = parseInt(updateSceneMatch[1], 10)
      const body = (await req.json()) as {
        displayName?: string
        isVisible?: boolean
      }
      const scene = await updateScene(id, body)
      if (!scene) {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: 'Scene not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      return handleCors(
        req,
        new Response(JSON.stringify({ data: scene }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch {
      return handleCors(
        req,
        new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
  }

  // PUT /api/livestream/obs/scenes/reorder
  if (
    req.method === 'PUT' &&
    url.pathname === '/api/livestream/obs/scenes/reorder'
  ) {
    try {
      const body = (await req.json()) as { sceneIds: number[] }
      if (!body.sceneIds || !Array.isArray(body.sceneIds)) {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: 'Missing sceneIds array' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      const scenes = await reorderScenes(body.sceneIds)
      return handleCors(
        req,
        new Response(JSON.stringify({ data: scenes }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch {
      return handleCors(
        req,
        new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
  }

  // POST /api/livestream/obs/scene/:name
  const switchSceneMatch = url.pathname.match(
    /^\/api\/livestream\/obs\/scene\/(.+)$/,
  )
  if (req.method === 'POST' && switchSceneMatch?.[1]) {
    try {
      const sceneName = decodeURIComponent(switchSceneMatch[1])
      await switchScene(sceneName)
      broadcastOBSCurrentScene(sceneName)
      return handleCors(
        req,
        new Response(JSON.stringify({ data: { success: true, sceneName } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch (error) {
      return handleCors(
        req,
        new Response(
          JSON.stringify({
            error:
              error instanceof Error ? error.message : 'Failed to switch scene',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }
  }

  // POST /api/livestream/obs/stream/start
  if (
    req.method === 'POST' &&
    url.pathname === '/api/livestream/obs/stream/start'
  ) {
    try {
      const youtubeConfig = await getYouTubeConfig()

      if (youtubeConfig.startSceneName) {
        await switchScene(youtubeConfig.startSceneName)
        broadcastOBSCurrentScene(youtubeConfig.startSceneName)
      }

      const broadcast = await createBroadcast()

      await startStreaming()

      const streamingStatus = obsConnection.getStreamingStatus()
      broadcastOBSStreamingStatus(streamingStatus)
      broadcastLivestreamStatus({
        isLive: true,
        broadcastId: broadcast.broadcastId,
        broadcastUrl: broadcast.url,
        title: broadcast.title,
        startedAt: Date.now(),
        updatedAt: Date.now(),
      })

      return handleCors(
        req,
        new Response(JSON.stringify({ data: { success: true, broadcast } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch (error) {
      return handleCors(
        req,
        new Response(
          JSON.stringify({
            error:
              error instanceof Error ? error.message : 'Failed to start stream',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }
  }

  // POST /api/livestream/obs/stream/stop
  if (
    req.method === 'POST' &&
    url.pathname === '/api/livestream/obs/stream/stop'
  ) {
    try {
      await stopStreaming()

      const activeBroadcast = await getActiveBroadcast()
      if (activeBroadcast) {
        await endBroadcast(activeBroadcast.broadcastId)
      }

      const streamingStatus = obsConnection.getStreamingStatus()
      broadcastOBSStreamingStatus(streamingStatus)
      broadcastLivestreamStatus({
        isLive: false,
        broadcastId: null,
        broadcastUrl: null,
        title: null,
        startedAt: null,
        updatedAt: Date.now(),
      })

      return handleCors(
        req,
        new Response(JSON.stringify({ data: { success: true } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch (error) {
      return handleCors(
        req,
        new Response(
          JSON.stringify({
            error:
              error instanceof Error ? error.message : 'Failed to stop stream',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }
  }

  // OBS Config endpoints
  // GET /api/livestream/obs/config
  if (req.method === 'GET' && url.pathname === '/api/livestream/obs/config') {
    const config = await getOBSConfig()
    return handleCors(
      req,
      new Response(JSON.stringify({ data: config }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // PUT /api/livestream/obs/config
  if (req.method === 'PUT' && url.pathname === '/api/livestream/obs/config') {
    try {
      const body = (await req.json()) as Partial<OBSConfig>
      const config = await updateOBSConfig(body)
      return handleCors(
        req,
        new Response(JSON.stringify({ data: config }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch {
      return handleCors(
        req,
        new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
  }

  // Message endpoint
  // GET /api/livestream/message
  if (req.method === 'GET' && url.pathname === '/api/livestream/message') {
    const broadcastUrl = url.searchParams.get('broadcastUrl') || undefined
    const message = generateBroadcastMessage(broadcastUrl)
    return handleCors(
      req,
      new Response(JSON.stringify({ data: { message } }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // No matching route
  return null
}
