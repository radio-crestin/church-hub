import type { ServerWebSocket } from 'bun'

import { wsLogger } from '../utils/fileLogger'

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

// Callback to get initial OBS status for new clients
let getOBSStatusCallback:
  | (() => {
      connection: OBSConnectionStatusMessage['payload']
      streaming: OBSStreamingStatusMessage['payload']
      currentScene: string | null
    })
  | null = null

/**
 * Register a callback to provide OBS status for new WebSocket clients
 */
export function setOBSStatusProvider(
  callback: () => {
    connection: OBSConnectionStatusMessage['payload']
    streaming: OBSStreamingStatusMessage['payload']
    currentScene: string | null
  },
) {
  getOBSStatusCallback = callback
}

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

  wsLogger.info(`Client connected: ${clientId} (total: ${clients.size})`)

  // Send initial OBS status to the new client
  if (getOBSStatusCallback) {
    try {
      const status = getOBSStatusCallback()

      // Send connection status
      ws.send(
        JSON.stringify({
          type: 'obs_connection_status',
          payload: status.connection,
        } satisfies OBSConnectionStatusMessage),
      )

      // Send streaming status
      ws.send(
        JSON.stringify({
          type: 'obs_streaming_status',
          payload: status.streaming,
        } satisfies OBSStreamingStatusMessage),
      )

      // Send current scene if connected
      if (status.currentScene) {
        ws.send(
          JSON.stringify({
            type: 'obs_current_scene',
            payload: {
              sceneName: status.currentScene,
              updatedAt: Date.now(),
            },
          } satisfies OBSCurrentSceneMessage),
        )
      }

      wsLogger.debug(`Sent initial OBS status to ${clientId}`)
    } catch (error) {
      wsLogger.error(
        `Failed to send initial OBS status to ${clientId}: ${error}`,
      )
    }
  }
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
    wsLogger.debug(`Message from ${ws.data.clientId}: ${JSON.stringify(data)}`)

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

      wsLogger.debug(
        `Broadcasting screen config preview for screen ${data.payload.screenId}`,
      )

      // Broadcast to all clients except the sender
      for (const [clientId, client] of clients) {
        if (clientId !== ws.data.clientId) {
          try {
            client.send(previewMessage)
          } catch (error) {
            wsLogger.error(`Failed to send preview to ${clientId}: ${error}`)
            clients.delete(clientId)
          }
        }
      }
    }

    // Handle MIDI-related messages from clients
    if (data.type?.startsWith('midi_') && midiMessageHandler) {
      midiMessageHandler(data.type, data.payload || {})
    }
  } catch (error) {
    wsLogger.error(`Failed to parse message: ${error}`)
  }
}

/**
 * Handles WebSocket disconnections
 */
export function handleWebSocketClose(ws: ServerWebSocket<WebSocketData>) {
  if (ws.data.clientId) {
    clients.delete(ws.data.clientId)
    wsLogger.info(
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

  wsLogger.debug(`Broadcasting to ${clients.size} clients`)

  for (const [clientId, ws] of clients) {
    try {
      ws.send(message)
    } catch (error) {
      wsLogger.error(`Failed to send to ${clientId}: ${error}`)
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

  wsLogger.debug(
    `Broadcasting screen config update for screen ${screenId} to ${clients.size} clients`,
  )

  for (const [clientId, ws] of clients) {
    try {
      ws.send(message)
    } catch (error) {
      wsLogger.error(`Failed to send to ${clientId}: ${error}`)
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

export type YouTubeAuthStatusMessage = {
  type: 'youtube_auth_status'
  payload: {
    isAuthenticated: boolean
    channelId?: string
    channelName?: string
    expiresAt?: number
    requiresReauth?: boolean
    error?: string
    updatedAt: number
  }
}

export type StreamStartStep =
  | 'creating_broadcast'
  | 'waiting_for_ready'
  | 'delay_before_stream'
  | 'starting_obs'
  | 'completed'
  | 'error'

export type StreamStartProgressMessage = {
  type: 'stream_start_progress'
  payload: {
    step: StreamStartStep
    progress: number
    message: string
    broadcastId?: string
    error?: string
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

  wsLogger.debug(
    `Broadcasting OBS connection status to ${clients.size} clients`,
  )

  for (const [clientId, ws] of clients) {
    try {
      ws.send(message)
    } catch (error) {
      wsLogger.error(`Failed to send to ${clientId}: ${error}`)
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

  wsLogger.debug(`Broadcasting OBS streaming status to ${clients.size} clients`)

  for (const [clientId, ws] of clients) {
    try {
      ws.send(message)
    } catch (error) {
      wsLogger.error(`Failed to send to ${clientId}: ${error}`)
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

  wsLogger.debug(`Broadcasting OBS current scene to ${clients.size} clients`)

  for (const [clientId, ws] of clients) {
    try {
      ws.send(message)
    } catch (error) {
      wsLogger.error(`Failed to send to ${clientId}: ${error}`)
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

  wsLogger.debug(`Broadcasting livestream status to ${clients.size} clients`)

  for (const [clientId, ws] of clients) {
    try {
      ws.send(message)
    } catch (error) {
      wsLogger.error(`Failed to send to ${clientId}: ${error}`)
      clients.delete(clientId)
    }
  }
}

/**
 * Broadcasts YouTube auth status to all connected clients
 */
export function broadcastYouTubeAuthStatus(
  status: YouTubeAuthStatusMessage['payload'],
) {
  const message = JSON.stringify({
    type: 'youtube_auth_status',
    payload: status,
  } satisfies YouTubeAuthStatusMessage)

  // Always log this important event
  wsLogger.info(`Broadcasting YouTube auth status to ${clients.size} clients: isAuthenticated=${status.isAuthenticated}`)
  // biome-ignore lint/suspicious/noConsole: debug logging
  console.log(`[websocket] Broadcasting YouTube auth status to ${clients.size} clients:`, status)

  for (const [clientId, ws] of clients) {
    try {
      ws.send(message)
      // biome-ignore lint/suspicious/noConsole: debug logging
      console.log(`[websocket] Sent YouTube auth status to client ${clientId}`)
    } catch (error) {
      wsLogger.error(`Failed to send to ${clientId}: ${error}`)
      // biome-ignore lint/suspicious/noConsole: debug logging
      console.error(`[websocket] Failed to send to ${clientId}:`, error)
      clients.delete(clientId)
    }
  }
}

/**
 * Broadcasts stream start progress to all connected clients
 */
export function broadcastStreamStartProgress(
  status: StreamStartProgressMessage['payload'],
) {
  const message = JSON.stringify({
    type: 'stream_start_progress',
    payload: status,
  } satisfies StreamStartProgressMessage)

  wsLogger.debug(
    `Broadcasting stream start progress (${status.step}) to ${clients.size} clients`,
  )

  for (const [clientId, ws] of clients) {
    try {
      ws.send(message)
    } catch (error) {
      wsLogger.error(`Failed to send to ${clientId}: ${error}`)
      clients.delete(clientId)
    }
  }
}

// MIDI message types
export type MIDIMessageEvent = {
  type: 'midi_message'
  payload: {
    type: 'note_on' | 'note_off' | 'control_change'
    channel: number
    note?: number
    controller?: number
    value: number
    timestamp: number
  }
}

export type MIDIDevicesEvent = {
  type: 'midi_devices'
  payload: {
    inputs: Array<{ id: number; name: string; type: 'input' }>
    outputs: Array<{ id: number; name: string; type: 'output' }>
  }
}

export type MIDIConnectionStatusEvent = {
  type: 'midi_connection_status'
  payload: {
    enabled: boolean
    inputConnected: boolean
    outputConnected: boolean
    inputDevice: string | null
    outputDevice: string | null
    inputDeviceId: number | null
    outputDeviceId: number | null
  }
}

/**
 * Broadcasts MIDI message to all connected clients
 */
export function broadcastMIDIMessage(message: MIDIMessageEvent['payload']) {
  const wsMessage = JSON.stringify({
    type: 'midi_message',
    payload: message,
  } satisfies MIDIMessageEvent)

  wsLogger.info(`Broadcasting MIDI message to ${clients.size} clients`, message)

  for (const [clientId, ws] of clients) {
    try {
      ws.send(wsMessage)
      wsLogger.debug(`Sent MIDI message to client ${clientId}`)
    } catch (error) {
      wsLogger.error(`Failed to send to ${clientId}: ${error}`)
      clients.delete(clientId)
    }
  }
}

/**
 * Broadcasts MIDI devices list to all connected clients
 */
export function broadcastMIDIDevices(devices: MIDIDevicesEvent['payload']) {
  const message = JSON.stringify({
    type: 'midi_devices',
    payload: devices,
  } satisfies MIDIDevicesEvent)

  wsLogger.debug(`Broadcasting MIDI devices to ${clients.size} clients`)

  for (const [clientId, ws] of clients) {
    try {
      ws.send(message)
    } catch (error) {
      wsLogger.error(`Failed to send to ${clientId}: ${error}`)
      clients.delete(clientId)
    }
  }
}

/**
 * Broadcasts MIDI connection status to all connected clients
 */
export function broadcastMIDIConnectionStatus(
  status: MIDIConnectionStatusEvent['payload'],
) {
  const message = JSON.stringify({
    type: 'midi_connection_status',
    payload: status,
  } satisfies MIDIConnectionStatusEvent)

  wsLogger.debug(
    `Broadcasting MIDI connection status to ${clients.size} clients`,
  )

  for (const [clientId, ws] of clients) {
    try {
      ws.send(message)
    } catch (error) {
      wsLogger.error(`Failed to send to ${clientId}: ${error}`)
      clients.delete(clientId)
    }
  }
}

// Callback for handling MIDI-related WebSocket messages
let midiMessageHandler:
  | ((type: string, payload: Record<string, unknown>) => void)
  | null = null

/**
 * Register a handler for MIDI WebSocket messages from clients
 */
export function setMIDIMessageHandler(
  handler: (type: string, payload: Record<string, unknown>) => void,
) {
  midiMessageHandler = handler
}
