const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [livestream-routes] ${message}`)
}

import { LIVESTREAM_PERMISSIONS } from './livestream-permissions'
import { holdsPermission } from '../middleware/permissions'
import {
  type CheckPermission,
  checkRoutePermission,
} from '../middleware/route-permissions'
import type { RequestContext } from '../middleware/types'
import { generateBroadcastMessage } from '../service/livestream/message'
import {
  getMixerChannels,
  getMixerConfig,
  testMixerConnection,
  updateMixerChannels,
  updateMixerConfig,
} from '../service/livestream/mixer'
import {
  createScene,
  deleteScene,
  getAllSceneShortcuts,
  getOBSConfig,
  getSceneAutomationState,
  getScenes,
  getVisibleScenes,
  obsConnection,
  reorderScenes,
  setSceneAutomationEnabled,
  switchScene,
  updateOBSConfig,
  updateScene,
} from '../service/livestream/obs'
import {
  isStreamStartInProgress,
  startStream,
  stopStream,
} from '../service/livestream/stream-control'
import type {
  ContentType,
  MixerConfig,
  OBSConfig,
} from '../service/livestream/types'
import {
  createBroadcast,
  endBroadcast,
  getActiveBroadcast,
  getAuthStatus,
  getBroadcastTemplate,
  getPastBroadcasts,
  getPlaylists,
  getStreamKeys,
  getUpcomingBroadcasts,
  getVideoCategories,
  getYouTubeConfig,
  logout,
  storeTokens,
  updateYouTubeConfig,
} from '../service/livestream/youtube'
import type { YouTubeConfigUpdate } from '../service/livestream/youtube/config'
import { loadMIDIShortcuts } from '../service/midi/shortcuts'
import { SecretDestinationChangedError } from '../service/secret-store'
import { createFlowStates } from '../utils/createFlowStates'
import { hideSecrets } from '../utils/hideSecrets'
import { toErrorMessage } from '../utils/toErrorMessage'
import {
  broadcastLivestreamStatus,
  broadcastOBSConnectionStatus,
  broadcastOBSCurrentScene,
  broadcastYouTubeAuthStatus,
} from '../websocket'

type HandleCors = (req: Request, res: Response) => Response

/**
 * YouTube sign-ins this server started. Tokens are stored only with one of
 * their states, so a link that lands on the app's callback page with tokens
 * of someone else's choosing can't connect another channel.
 */
const youtubeSignIns = createFlowStates()

export async function handleLivestreamRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
  checkPermission: CheckPermission,
  context: RequestContext | null,
): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/livestream/')) return null
  const refused = checkRoutePermission(
    req,
    url.pathname,
    LIVESTREAM_PERMISSIONS,
    checkPermission,
  )
  if (refused) return refused
  // YouTube OAuth endpoints

  // POST /api/livestream/youtube/sign-in - Starts a YouTube sign-in: the
  // state its tokens must come back with (single use, 10 minutes)
  if (
    req.method === 'POST' &&
    url.pathname === '/api/livestream/youtube/sign-in'
  ) {
    return handleCors(
      req,
      new Response(
        JSON.stringify({ data: { state: youtubeSignIns.issue() } }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )
  }

  // POST /api/livestream/youtube/tokens - Store the tokens a sign-in brought
  // back, with the state POST /api/livestream/youtube/sign-in gave it
  if (
    req.method === 'POST' &&
    url.pathname === '/api/livestream/youtube/tokens'
  ) {
    // biome-ignore lint/suspicious/noConsole: debug logging
    console.log(
      '[livestream-routes] Received POST /api/livestream/youtube/tokens',
    )
    try {
      const body = (await req.json()) as {
        state?: string
        accessToken: string
        refreshToken: string
        expiresAt: number
        channelId?: string
        channelName?: string
      }

      if (!youtubeSignIns.consume(body.state)) {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: 'unknown_sign_in' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      if (!body.accessToken || !body.refreshToken || !body.expiresAt) {
        return handleCors(
          req,
          new Response(
            JSON.stringify({ error: 'Missing required token fields' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }

      // biome-ignore lint/suspicious/noConsole: debug logging
      console.log('[livestream-routes] Storing YouTube tokens...')
      let status: Awaited<ReturnType<typeof storeTokens>>
      try {
        status = await storeTokens({
          accessToken: body.accessToken,
          refreshToken: body.refreshToken,
          expiresAt: new Date(body.expiresAt),
          channelId: body.channelId,
          channelName: body.channelName,
        })
        // biome-ignore lint/suspicious/noConsole: debug logging
        console.log('[livestream-routes] Tokens stored, status:', status)
      } catch (storeError) {
        // biome-ignore lint/suspicious/noConsole: debug logging
        console.error('[livestream-routes] ERROR storing tokens:', storeError)
        throw storeError
      }

      // Broadcast auth status to all clients
      // biome-ignore lint/suspicious/noConsole: debug logging
      console.log('[livestream-routes] Broadcasting YouTube auth status...')
      broadcastYouTubeAuthStatus({
        isAuthenticated: status.isAuthenticated,
        channelId: status.channelId,
        channelName: status.channelName,
        expiresAt: status.expiresAt,
        updatedAt: Date.now(),
      })

      return handleCors(
        req,
        new Response(JSON.stringify({ data: status }), {
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
              error instanceof Error ? error.message : 'Failed to store tokens',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
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

    // Broadcast auth status to all clients
    broadcastYouTubeAuthStatus({
      isAuthenticated: false,
      updatedAt: Date.now(),
    })

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

  // GET /api/livestream/youtube/broadcasts/upcoming
  if (
    req.method === 'GET' &&
    url.pathname === '/api/livestream/youtube/broadcasts/upcoming'
  ) {
    try {
      const broadcasts = await getUpcomingBroadcasts()
      return handleCors(
        req,
        new Response(JSON.stringify({ data: broadcasts }), {
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
                : 'Failed to get upcoming broadcasts',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }
  }

  // GET /api/livestream/youtube/broadcasts/completed
  if (
    req.method === 'GET' &&
    url.pathname === '/api/livestream/youtube/broadcasts/completed'
  ) {
    try {
      const broadcasts = await getPastBroadcasts()
      return handleCors(
        req,
        new Response(JSON.stringify({ data: broadcasts }), {
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
                : 'Failed to get past broadcasts',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }
  }

  // GET /api/livestream/youtube/playlists
  if (
    req.method === 'GET' &&
    url.pathname === '/api/livestream/youtube/playlists'
  ) {
    try {
      const playlists = await getPlaylists()
      return handleCors(
        req,
        new Response(JSON.stringify({ data: playlists }), {
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
                : 'Failed to get playlists',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }
  }

  // GET /api/livestream/youtube/categories?hl=ro
  if (
    req.method === 'GET' &&
    url.pathname === '/api/livestream/youtube/categories'
  ) {
    try {
      const categories = await getVideoCategories(
        url.searchParams.get('hl') || 'en',
      )
      return handleCors(
        req,
        new Response(JSON.stringify({ data: categories }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch (error) {
      return handleCors(
        req,
        new Response(
          JSON.stringify({
            error: toErrorMessage(error),
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }
  }

  // GET /api/livestream/youtube/broadcasts/:id/template
  const templateMatch = url.pathname.match(
    /^\/api\/livestream\/youtube\/broadcasts\/([^/]+)\/template$/,
  )
  if (req.method === 'GET' && templateMatch?.[1]) {
    try {
      const template = await getBroadcastTemplate(
        decodeURIComponent(templateMatch[1]),
      )
      return handleCors(
        req,
        new Response(JSON.stringify({ data: template }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch (error) {
      return handleCors(
        req,
        new Response(
          JSON.stringify({
            error: toErrorMessage(error),
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
    let body: YouTubeConfigUpdate
    try {
      body = (await req.json()) as YouTubeConfigUpdate
    } catch {
      return handleCors(
        req,
        new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    try {
      const config = await updateYouTubeConfig(body)
      return handleCors(
        req,
        new Response(JSON.stringify({ data: config }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch (error) {
      log(
        'error',
        `Failed to update YouTube config: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
      return handleCors(
        req,
        new Response(
          JSON.stringify({
            error: 'Failed to update config',
            details: error instanceof Error ? error.message : 'Unknown error',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
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
      // Enable auto-reconnect to maintain permanent connection
      obsConnection.enableAutoReconnect(true)
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
      const errorMessage = toErrorMessage(error)
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

  // POST /api/livestream/obs/scenes/sync - Sync scenes from OBS
  if (
    req.method === 'POST' &&
    url.pathname === '/api/livestream/obs/scenes/sync'
  ) {
    try {
      // getScenes() already syncs from OBS - it fetches OBS scenes and upserts new ones
      const scenes = await getScenes()
      return handleCors(
        req,
        new Response(JSON.stringify({ data: scenes }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to sync scenes'
      return handleCors(
        req,
        new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
  }

  // POST /api/livestream/obs/scenes - Create custom scene
  if (req.method === 'POST' && url.pathname === '/api/livestream/obs/scenes') {
    try {
      const body = (await req.json()) as { sceneName: string }
      if (!body.sceneName || typeof body.sceneName !== 'string') {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: 'Missing sceneName' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      const scene = await createScene(body.sceneName.trim())
      return handleCors(
        req,
        new Response(JSON.stringify({ data: scene }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create scene'
      return handleCors(
        req,
        new Response(JSON.stringify({ error: message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
  }

  // DELETE /api/livestream/obs/scenes/:id
  const deleteSceneMatch = url.pathname.match(
    /^\/api\/livestream\/obs\/scenes\/(\d+)$/,
  )
  if (req.method === 'DELETE' && deleteSceneMatch?.[1]) {
    try {
      const id = parseInt(deleteSceneMatch[1], 10)
      await deleteScene(id)
      return handleCors(
        req,
        new Response(JSON.stringify({ data: { success: true } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete scene'
      return handleCors(
        req,
        new Response(JSON.stringify({ error: message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
  }

  // GET /api/livestream/obs/shortcuts
  if (
    req.method === 'GET' &&
    url.pathname === '/api/livestream/obs/shortcuts'
  ) {
    const shortcuts = await getAllSceneShortcuts()
    return handleCors(
      req,
      new Response(JSON.stringify({ data: shortcuts }), {
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
        shortcuts?: string[]
        contentTypes?: ContentType[]
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

      // Reload MIDI shortcuts if scene shortcuts were updated
      if (body.shortcuts !== undefined) {
        loadMIDIShortcuts()
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

  // GET /api/livestream/obs/scene-automation - Get scene automation state
  if (
    req.method === 'GET' &&
    url.pathname === '/api/livestream/obs/scene-automation'
  ) {
    const state = getSceneAutomationState()
    return handleCors(
      req,
      new Response(JSON.stringify({ data: state }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // PUT /api/livestream/obs/scene-automation - Enable/disable scene automation
  if (
    req.method === 'PUT' &&
    url.pathname === '/api/livestream/obs/scene-automation'
  ) {
    try {
      const body = (await req.json()) as { enabled: boolean }
      if (typeof body.enabled !== 'boolean') {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: 'Missing enabled boolean' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      const state = setSceneAutomationEnabled(body.enabled)
      return handleCors(
        req,
        new Response(JSON.stringify({ data: state }), {
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
    // Prevent concurrent stream start requests
    if (isStreamStartInProgress()) {
      log('warning', 'Stream start already in progress, rejecting request')
      return handleCors(
        req,
        new Response(
          JSON.stringify({ error: 'Stream start already in progress' }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }

    const result = await startStream()

    if (result.success) {
      return handleCors(
        req,
        new Response(
          JSON.stringify({
            data: { success: true, broadcast: result.broadcast },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      )
    } else {
      return handleCors(
        req,
        new Response(JSON.stringify({ error: result.error }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
  }

  // POST /api/livestream/obs/stream/stop
  if (
    req.method === 'POST' &&
    url.pathname === '/api/livestream/obs/stream/stop'
  ) {
    const result = await stopStream()

    if (result.success) {
      return handleCors(
        req,
        new Response(JSON.stringify({ data: { success: true } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } else {
      return handleCors(
        req,
        new Response(JSON.stringify({ error: result.error }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
  }

  // OBS Config endpoints
  // GET /api/livestream/obs/config
  // The password only to who may change it (they copy it into OBS)
  if (req.method === 'GET' && url.pathname === '/api/livestream/obs/config') {
    const config = await getOBSConfig()
    const shown = holdsPermission(context, 'settings.edit')
      ? config
      : hideSecrets(config, { password: 'passwordSet' })
    return handleCors(
      req,
      new Response(JSON.stringify({ data: shown }), {
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
    } catch (error) {
      const message =
        error instanceof SecretDestinationChangedError
          ? error.message
          : 'Invalid JSON body'
      return handleCors(
        req,
        new Response(JSON.stringify({ error: message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
  }

  // Mixer Config endpoints
  // GET /api/livestream/mixer/config
  if (req.method === 'GET' && url.pathname === '/api/livestream/mixer/config') {
    const config = await getMixerConfig()
    return handleCors(
      req,
      new Response(JSON.stringify({ data: config }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // PUT /api/livestream/mixer/config
  if (req.method === 'PUT' && url.pathname === '/api/livestream/mixer/config') {
    try {
      const body = (await req.json()) as Partial<MixerConfig>
      const config = await updateMixerConfig(body)
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

  // GET /api/livestream/mixer/channels
  if (
    req.method === 'GET' &&
    url.pathname === '/api/livestream/mixer/channels'
  ) {
    const channels = await getMixerChannels()
    return handleCors(
      req,
      new Response(JSON.stringify({ data: channels }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  // PUT /api/livestream/mixer/channels
  if (
    req.method === 'PUT' &&
    url.pathname === '/api/livestream/mixer/channels'
  ) {
    try {
      const body = (await req.json()) as {
        channels: { channelNumber: number; label: string }[]
      }
      if (!body.channels || !Array.isArray(body.channels)) {
        return handleCors(
          req,
          new Response(JSON.stringify({ error: 'Invalid channels array' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      const channels = await updateMixerChannels(body.channels)
      return handleCors(
        req,
        new Response(JSON.stringify({ data: channels }), {
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

  // POST /api/livestream/mixer/test
  if (req.method === 'POST' && url.pathname === '/api/livestream/mixer/test') {
    try {
      const result = await testMixerConnection()
      return handleCors(
        req,
        new Response(JSON.stringify({ data: result }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    } catch (error) {
      return handleCors(
        req,
        new Response(
          JSON.stringify({
            data: {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
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
