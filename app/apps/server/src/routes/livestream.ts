const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [livestream-routes] ${message}`)
}

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
  YouTubeConfig,
} from '../service/livestream/types'
import {
  consumePKCESession,
  createBroadcast,
  endBroadcast,
  getActiveBroadcast,
  getAuthStatus,
  getPastBroadcasts,
  getPlaylists,
  getStreamKeys,
  getUpcomingBroadcasts,
  getYouTubeConfig,
  logout,
  storePKCESession,
  storeTokens,
  updateYouTubeConfig,
} from '../service/livestream/youtube'
import { loadMIDIShortcuts } from '../service/midi/shortcuts'
import {
  broadcastLivestreamStatus,
  broadcastOBSConnectionStatus,
  broadcastOBSCurrentScene,
  broadcastYouTubeAuthStatus,
} from '../websocket'

type HandleCors = (req: Request, res: Response) => Response

// Environment variables for OAuth (needed for server-side token exchange)
// Note: Google requires client_secret even for Desktop apps with PKCE
const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || ''
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || ''
const YOUTUBE_REDIRECT_URI =
  'http://localhost:3000/api/livestream/youtube/callback'

export async function handleLivestreamRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
): Promise<Response | null> {
  // YouTube OAuth endpoints

  // POST /api/livestream/youtube/pkce-session - Store PKCE session for server-side token exchange
  // Used when auth is initiated from Tauri and callback can't use postMessage
  if (
    req.method === 'POST' &&
    url.pathname === '/api/livestream/youtube/pkce-session'
  ) {
    try {
      const body = (await req.json()) as {
        codeVerifier: string
        codeChallenge: string
      }

      if (!body.codeVerifier || !body.codeChallenge) {
        return handleCors(
          req,
          new Response(
            JSON.stringify({ error: 'Missing codeVerifier or codeChallenge' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }

      const sessionId = storePKCESession(body.codeVerifier, body.codeChallenge)

      return handleCors(
        req,
        new Response(JSON.stringify({ data: { sessionId } }), {
          status: 201,
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

  // GET /api/livestream/youtube/callback - Handles OAuth callback
  // If there's a PKCE session ID in state, exchanges tokens server-side
  // Otherwise sends code to client via postMessage for client-side exchange
  if (
    req.method === 'GET' &&
    url.pathname === '/api/livestream/youtube/callback'
  ) {
    const code = url.searchParams.get('code')
    const error = url.searchParams.get('error')
    const state = url.searchParams.get('state')

    if (error) {
      return handleCors(
        req,
        new Response(
          `<!DOCTYPE html>
          <html>
          <body>
            <script>
              window.opener?.postMessage({ type: 'youtube-auth-error', error: '${error}' }, '*');
              window.close();
            </script>
            <p>Authorization failed: ${error}. You can close this window.</p>
          </body>
          </html>`,
          { headers: { 'Content-Type': 'text/html' } },
        ),
      )
    }

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

    // Check if there's a PKCE session ID in state (used for Tauri/external browser flow)
    if (state) {
      const session = consumePKCESession(state)
      if (session) {
        try {
          // Exchange code for tokens on the server
          const tokenResponse = await fetch(
            'https://oauth2.googleapis.com/token',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                client_id: YOUTUBE_CLIENT_ID,
                client_secret: YOUTUBE_CLIENT_SECRET,
                code,
                code_verifier: session.codeVerifier,
                grant_type: 'authorization_code',
                redirect_uri: YOUTUBE_REDIRECT_URI,
              }),
            },
          )

          if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json()
            throw new Error(
              errorData.error_description || 'Token exchange failed',
            )
          }

          const tokenData = await tokenResponse.json()

          // Store tokens
          const status = await storeTokens({
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
          })

          // Broadcast auth status to all clients
          broadcastYouTubeAuthStatus({
            isAuthenticated: status.isAuthenticated,
            channelId: status.channelId,
            channelName: status.channelName,
            expiresAt: status.expiresAt,
            updatedAt: Date.now(),
          })

          return handleCors(
            req,
            new Response(
              `<!DOCTYPE html>
              <html>
              <body>
                <p>Authorization successful! You can close this window.</p>
                <p>Connected as: ${status.channelName || 'Unknown'}</p>
              </body>
              </html>`,
              { headers: { 'Content-Type': 'text/html' } },
            ),
          )
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : 'Token exchange failed'
          return handleCors(
            req,
            new Response(
              `<!DOCTYPE html>
              <html>
              <body>
                <p>Authorization failed: ${errorMessage}</p>
                <p>You can close this window and try again.</p>
              </body>
              </html>`,
              { headers: { 'Content-Type': 'text/html' } },
            ),
          )
        }
      }
    }

    // No PKCE session - use postMessage for client-side token exchange (popup flow)
    return handleCors(
      req,
      new Response(
        `<!DOCTYPE html>
        <html>
        <body>
          <script>
            window.opener?.postMessage({ type: 'youtube-auth-code', code: '${code}' }, '*');
            window.close();
          </script>
          <p>Authorization successful! You can close this window.</p>
        </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' } },
      ),
    )
  }

  // POST /api/livestream/youtube/tokens - Store tokens from client after PKCE exchange
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
        accessToken: string
        refreshToken: string
        expiresAt: number
        channelId?: string
        channelName?: string
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
    let body: Partial<YouTubeConfig>
    try {
      body = (await req.json()) as Partial<YouTubeConfig>
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
