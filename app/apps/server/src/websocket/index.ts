import type { ServerWebSocket } from 'bun'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [websocket] ${message}`)
}

export interface WebSocketData {
  clientId: string
  displayId?: number
}

export type PresentationMessage = {
  type: 'presentation_state'
  payload: {
    programId: number | null
    currentSlideId: number | null
    isPresenting: boolean
    updatedAt: number
  }
}

export type ScreenConfigUpdatedMessage = {
  type: 'screen_config_updated'
  payload: {
    screenId: number
    updatedAt: number
  }
}

export type ScreenConfigPreviewMessage = {
  type: 'screen_config_preview'
  payload: {
    screenId: number
    config: Record<string, unknown>
    updatedAt: number
  }
}

// Store connected clients
const clients = new Map<string, ServerWebSocket<WebSocketData>>()

/**
 * Generates a unique client ID
 */
function generateClientId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Handles new WebSocket connections
 */
export function handleWebSocketOpen(ws: ServerWebSocket<WebSocketData>) {
  const clientId = ws.data.clientId || generateClientId()
  ws.data.clientId = clientId
  clients.set(clientId, ws)

  log('info', `Client connected: ${clientId} (total: ${clients.size})`)
}

/**
 * Handles WebSocket messages from clients
 */
export function handleWebSocketMessage(
  ws: ServerWebSocket<WebSocketData>,
  message: string | Buffer,
) {
  try {
    const data = JSON.parse(message.toString())
    log('debug', `Message from ${ws.data.clientId}: ${JSON.stringify(data)}`)

    // Handle ping/pong for keepalive
    if (data.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }))
      return
    }

    // Handle screen config preview - broadcast to all other clients
    if (data.type === 'screen_config_preview') {
      const previewMessage = JSON.stringify({
        type: 'screen_config_preview',
        payload: {
          screenId: data.payload.screenId,
          config: data.payload.config,
          updatedAt: Date.now(),
        },
      } satisfies ScreenConfigPreviewMessage)

      log(
        'debug',
        `Broadcasting screen config preview for screen ${data.payload.screenId}`,
      )

      // Broadcast to all clients except the sender
      for (const [clientId, client] of clients) {
        if (clientId !== ws.data.clientId) {
          try {
            client.send(previewMessage)
          } catch (error) {
            log('error', `Failed to send preview to ${clientId}: ${error}`)
            clients.delete(clientId)
          }
        }
      }
    }
  } catch (error) {
    log('error', `Failed to parse message: ${error}`)
  }
}

/**
 * Handles WebSocket disconnections
 */
export function handleWebSocketClose(ws: ServerWebSocket<WebSocketData>) {
  if (ws.data.clientId) {
    clients.delete(ws.data.clientId)
    log(
      'info',
      `Client disconnected: ${ws.data.clientId} (total: ${clients.size})`,
    )
  }
}

/**
 * Broadcasts presentation state to all connected clients
 */
export function broadcastPresentationState(
  state: PresentationMessage['payload'],
) {
  const message = JSON.stringify({
    type: 'presentation_state',
    payload: state,
  } satisfies PresentationMessage)

  log('debug', `Broadcasting to ${clients.size} clients`)

  for (const [clientId, ws] of clients) {
    try {
      ws.send(message)
    } catch (error) {
      log('error', `Failed to send to ${clientId}: ${error}`)
      clients.delete(clientId)
    }
  }
}

/**
 * Broadcasts screen config update to all connected clients
 */
export function broadcastScreenConfigUpdated(screenId: number) {
  const message = JSON.stringify({
    type: 'screen_config_updated',
    payload: {
      screenId,
      updatedAt: Date.now(),
    },
  } satisfies ScreenConfigUpdatedMessage)

  log(
    'debug',
    `Broadcasting screen config update for screen ${screenId} to ${clients.size} clients`,
  )

  for (const [clientId, ws] of clients) {
    try {
      ws.send(message)
    } catch (error) {
      log('error', `Failed to send to ${clientId}: ${error}`)
      clients.delete(clientId)
    }
  }
}

/**
 * Gets the number of connected clients
 */
export function getConnectedClients(): number {
  return clients.size
}

// OBS/Livestream message types
export type OBSConnectionStatusMessage = {
  type: 'obs_connection_status'
  payload: {
    connected: boolean
    host: string
    port: number
    error?: string
    updatedAt: number
  }
}

export type OBSStreamingStatusMessage = {
  type: 'obs_streaming_status'
  payload: {
    isStreaming: boolean
    isRecording: boolean
    updatedAt: number
  }
}

export type OBSCurrentSceneMessage = {
  type: 'obs_current_scene'
  payload: {
    sceneName: string
    updatedAt: number
  }
}

export type LivestreamStatusMessage = {
  type: 'livestream_status'
  payload: {
    isLive: boolean
    broadcastId: string | null
    broadcastUrl: string | null
    title: string | null
    startedAt: number | null
    updatedAt: number
  }
}

/**
 * Broadcasts OBS connection status to all connected clients
 */
export function broadcastOBSConnectionStatus(
  status: OBSConnectionStatusMessage['payload'],
) {
  const message = JSON.stringify({
    type: 'obs_connection_status',
    payload: status,
  } satisfies OBSConnectionStatusMessage)

  log('debug', `Broadcasting OBS connection status to ${clients.size} clients`)

  for (const [clientId, ws] of clients) {
    try {
      ws.send(message)
    } catch (error) {
      log('error', `Failed to send to ${clientId}: ${error}`)
      clients.delete(clientId)
    }
  }
}

/**
 * Broadcasts OBS streaming status to all connected clients
 */
export function broadcastOBSStreamingStatus(
  status: OBSStreamingStatusMessage['payload'],
) {
  const message = JSON.stringify({
    type: 'obs_streaming_status',
    payload: status,
  } satisfies OBSStreamingStatusMessage)

  log('debug', `Broadcasting OBS streaming status to ${clients.size} clients`)

  for (const [clientId, ws] of clients) {
    try {
      ws.send(message)
    } catch (error) {
      log('error', `Failed to send to ${clientId}: ${error}`)
      clients.delete(clientId)
    }
  }
}

/**
 * Broadcasts current OBS scene to all connected clients
 */
export function broadcastOBSCurrentScene(sceneName: string) {
  const message = JSON.stringify({
    type: 'obs_current_scene',
    payload: {
      sceneName,
      updatedAt: Date.now(),
    },
  } satisfies OBSCurrentSceneMessage)

  log('debug', `Broadcasting OBS current scene to ${clients.size} clients`)

  for (const [clientId, ws] of clients) {
    try {
      ws.send(message)
    } catch (error) {
      log('error', `Failed to send to ${clientId}: ${error}`)
      clients.delete(clientId)
    }
  }
}

/**
 * Broadcasts livestream status to all connected clients
 */
export function broadcastLivestreamStatus(
  status: LivestreamStatusMessage['payload'],
) {
  const message = JSON.stringify({
    type: 'livestream_status',
    payload: status,
  } satisfies LivestreamStatusMessage)

  log('debug', `Broadcasting livestream status to ${clients.size} clients`)

  for (const [clientId, ws] of clients) {
    try {
      ws.send(message)
    } catch (error) {
      log('error', `Failed to send to ${clientId}: ${error}`)
      clients.delete(clientId)
    }
  }
}
