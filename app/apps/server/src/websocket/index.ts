import type { ServerWebSocket } from 'bun'

import {
  handleAudioControllerMessage,
  isAudioController,
  registerAudioController,
  unregisterAudioController,
} from './audio-controller'
import {
  clearTemporaryContent,
  presentTemporaryScreenShare,
} from '../service/presentation/presentation-state'
import type {
  PresentationState,
  TextStyleRange,
} from '../service/presentation/types'
import { wsLogger } from '../utils/fileLogger'

export interface WebSocketData {
  clientId: string
  displayId?: number
}

export type PresentationMessage = {
  type: 'presentation_state'
  payload: PresentationState
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

export type SlideHighlightsUpdatedMessage = {
  type: 'slide_highlights_updated'
  payload: {
    highlights: TextStyleRange[]
    updatedAt: number
  }
}

// ============================================================================
// WEBRTC SCREEN SHARE MESSAGE TYPES
// ============================================================================

export type ScreenShareStartedMessage = {
  type: 'screen_share_started'
  payload: {
    broadcasterId: string
    audioEnabled: boolean
    startedAt: number
  }
}

export type ScreenShareStoppedMessage = {
  type: 'screen_share_stopped'
  payload: {
    broadcasterId: string
    stoppedAt: number
    stoppedBy?: string // Who stopped the share (may differ from broadcaster)
  }
}

export type WebRTCOfferMessage = {
  type: 'webrtc_offer'
  payload: {
    broadcasterId: string
    targetClientId: string
    sdp: string
  }
}

export type WebRTCAnswerMessage = {
  type: 'webrtc_answer'
  payload: {
    viewerId: string
    targetClientId: string
    sdp: string
  }
}

export type WebRTCIceCandidateMessage = {
  type: 'webrtc_ice_candidate'
  payload: {
    fromClientId: string
    targetClientId: string
    candidate: {
      candidate: string
      sdpMid: string | null
      sdpMLineIndex: number | null
      usernameFragment: string | null
    }
  }
}

export type ScreenShareJoinRequestMessage = {
  type: 'screen_share_join_request'
  payload: {
    viewerId: string
  }
}

// Store connected clients with last activity timestamp
interface ClientConnection {
  ws: ServerWebSocket<WebSocketData>
  lastActivity: number
}
const clients = new Map<string, ClientConnection>()

// Track active screen share state
interface ActiveScreenShare {
  broadcasterId: string
  audioEnabled: boolean
  startedAt: number
}
let activeScreenShare: ActiveScreenShare | null = null

/**
 * Get active screen share state
 */
export function getActiveScreenShare(): ActiveScreenShare | null {
  return activeScreenShare
}

/**
 * Stop active screen share and broadcast to all clients
 * Used when presenting other content (Bible/song) that should stop screen sharing
 */
export function stopActiveScreenShare(): void {
  if (!activeScreenShare) return

  const broadcasterId = activeScreenShare.broadcasterId
  const message = JSON.stringify({
    type: 'screen_share_stopped',
    payload: {
      broadcasterId,
      stoppedAt: Date.now(),
      stoppedBy: 'system', // Stopped by presenting other content
    },
  } satisfies ScreenShareStoppedMessage)

  activeScreenShare = null
  wsLogger.info(`Screen share stopped due to presenting other content`)

  // Broadcast to all clients
  for (const [id, conn] of clients) {
    try {
      conn.ws.send(message)
    } catch (error) {
      wsLogger.error(`Failed to broadcast screen share stop to ${id}: ${error}`)
    }
  }
}

/**
 * Send message to a specific client
 */
function sendToClient(
  targetClientId: string,
  message: Record<string, unknown>,
): boolean {
  const client = clients.get(targetClientId)
  if (client) {
    try {
      client.ws.send(JSON.stringify(message))
      return true
    } catch (error) {
      wsLogger.error(`Failed to send to ${targetClientId}: ${error}`)
      clients.delete(targetClientId)
    }
  }
  return false
}

/**
 * Get all connected client IDs
 */
export function getAllClientIds(): string[] {
  return Array.from(clients.keys())
}

// Track if any client is recording a shortcut (disables MIDI shortcut execution)
let shortcutRecordingInProgress = false

/**
 * Check if any client is currently recording a shortcut
 * Used by MIDI shortcut handler to skip execution during recording
 */
export function isShortcutRecordingActive(): boolean {
  return shortcutRecordingInProgress
}

// Stale connection cleanup interval (60 seconds)
const STALE_CHECK_INTERVAL_MS = 60_000
// Consider connection stale after 90 seconds of no activity (3x ping interval of 30s)
const STALE_TIMEOUT_MS = 90_000

/**
 * Clean up stale connections that haven't sent any activity
 */
function cleanupStaleConnections() {
  const now = Date.now()
  let cleanedCount = 0

  for (const [clientId, client] of clients) {
    const inactiveTime = now - client.lastActivity
    if (inactiveTime > STALE_TIMEOUT_MS) {
      wsLogger.info(
        `Removing stale client ${clientId} (inactive for ${Math.round(inactiveTime / 1000)}s)`,
      )
      try {
        client.ws.close(1000, 'Connection stale')
      } catch {
        // Ignore close errors on already dead connections
      }
      clients.delete(clientId)
      cleanedCount++
    }
  }

  if (cleanedCount > 0) {
    wsLogger.info(
      `Cleaned up ${cleanedCount} stale connections (remaining: ${clients.size})`,
    )
  }
}

// Start the stale connection cleanup interval
setInterval(cleanupStaleConnections, STALE_CHECK_INTERVAL_MS)

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

// Callback to get initial music player state for new clients
let getMusicStateCallback:
  | (() => MusicPlayerStateMessage['payload'] | null)
  | null = null

/**
 * Register a callback to provide music player state for new WebSocket clients
 */
export function setMusicStateProvider(
  callback: () => MusicPlayerStateMessage['payload'] | null,
) {
  getMusicStateCallback = callback
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
  clients.set(clientId, { ws, lastActivity: Date.now() })

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

  // Send initial music player state to the new client
  if (getMusicStateCallback) {
    try {
      const musicState = getMusicStateCallback()

      if (musicState) {
        ws.send(
          JSON.stringify({
            type: 'music_state',
            payload: musicState,
          } satisfies MusicPlayerStateMessage),
        )
        wsLogger.debug(`Sent initial music state to ${clientId}`)
      }
    } catch (error) {
      wsLogger.error(
        `Failed to send initial music state to ${clientId}: ${error}`,
      )
    }
  }

  // Send active screen share state to the new client
  if (activeScreenShare) {
    try {
      ws.send(
        JSON.stringify({
          type: 'screen_share_started',
          payload: activeScreenShare,
        } satisfies ScreenShareStartedMessage),
      )
      wsLogger.debug(`Sent active screen share state to ${clientId}`)
    } catch (error) {
      wsLogger.error(
        `Failed to send screen share state to ${clientId}: ${error}`,
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
    const clientId = ws.data.clientId

    // Update last activity time for this client
    const client = clients.get(clientId)
    if (client) {
      client.lastActivity = Date.now()
    }

    wsLogger.debug(`Message from ${clientId}: ${JSON.stringify(data)}`)

    // Handle ping/pong for keepalive
    if (data.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }))
      return
    }

    // Handle audio controller registration (Tauri connects as audio controller)
    if (data.type === 'audio_controller_register') {
      registerAudioController(ws)
      return
    }

    // Handle audio controller state updates
    if (data.type === 'audio_state_update' || data.type === 'audio_finished') {
      handleAudioControllerMessage(data)
      return
    }

    // Handle shortcut recording state changes (disables MIDI shortcuts during recording)
    if (data.type === 'shortcut_recording_start') {
      shortcutRecordingInProgress = true
      wsLogger.debug(`Shortcut recording started by ${clientId}`)
      return
    }

    if (data.type === 'shortcut_recording_stop') {
      shortcutRecordingInProgress = false
      wsLogger.debug(`Shortcut recording stopped by ${clientId}`)
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
      for (const [id, conn] of clients) {
        if (id !== ws.data.clientId) {
          try {
            conn.ws.send(previewMessage)
          } catch (error) {
            wsLogger.error(`Failed to send preview to ${id}: ${error}`)
            clients.delete(id)
          }
        }
      }
    }

    // Handle MIDI-related messages from clients
    if (data.type?.startsWith('midi_') && midiMessageHandler) {
      midiMessageHandler(data.type, data.payload || {})
    }

    // Handle Music Player messages from clients
    if (data.type?.startsWith('music_') && musicCommandHandler) {
      musicCommandHandler(data.type, data.payload || {})
    }

    // Handle WebRTC screen share signaling
    if (data.type === 'screen_share_start') {
      activeScreenShare = {
        broadcasterId: clientId,
        audioEnabled: data.payload?.audioEnabled ?? false,
        startedAt: Date.now(),
      }

      // Update presentation state to show screen share on displays
      const newState = presentTemporaryScreenShare({
        broadcasterId: clientId,
        audioEnabled: activeScreenShare.audioEnabled,
      })

      const message = JSON.stringify({
        type: 'screen_share_started',
        payload: activeScreenShare,
      } satisfies ScreenShareStartedMessage)

      wsLogger.info(
        `Screen share started by ${clientId} (audio: ${activeScreenShare.audioEnabled})`,
      )

      // Broadcast both the screen share message and the presentation state
      for (const [id, conn] of clients) {
        try {
          conn.ws.send(message)
        } catch (error) {
          wsLogger.error(`Failed to send to ${id}: ${error}`)
          clients.delete(id)
        }
      }

      // Broadcast updated presentation state
      broadcastPresentationState(newState)
      return
    }

    if (data.type === 'screen_share_stop') {
      // Allow any client to stop the screen share (not just broadcaster)
      if (activeScreenShare) {
        const broadcasterId = activeScreenShare.broadcasterId
        const message = JSON.stringify({
          type: 'screen_share_stopped',
          payload: {
            broadcasterId,
            stoppedAt: Date.now(),
            stoppedBy: clientId, // Track who stopped it
          },
        } satisfies ScreenShareStoppedMessage)

        activeScreenShare = null
        wsLogger.info(
          `Screen share stopped by ${clientId} (broadcaster was ${broadcasterId})`,
        )

        // Clear presentation state
        const newState = clearTemporaryContent()

        for (const [id, conn] of clients) {
          try {
            conn.ws.send(message)
          } catch (error) {
            wsLogger.error(`Failed to send to ${id}: ${error}`)
            clients.delete(id)
          }
        }

        // Broadcast updated presentation state
        broadcastPresentationState(newState)
      }
      return
    }

    if (data.type === 'screen_share_join_request') {
      // Forward join request to broadcaster
      if (activeScreenShare) {
        sendToClient(activeScreenShare.broadcasterId, {
          type: 'screen_share_join_request',
          payload: { viewerId: clientId },
        })
        wsLogger.debug(
          `Join request from ${clientId} forwarded to broadcaster ${activeScreenShare.broadcasterId}`,
        )
      }
      return
    }

    if (data.type === 'webrtc_offer') {
      // Forward offer to target client
      sendToClient(data.payload.targetClientId, {
        type: 'webrtc_offer',
        payload: {
          broadcasterId: clientId,
          targetClientId: data.payload.targetClientId,
          sdp: data.payload.sdp,
        },
      })
      wsLogger.debug(
        `WebRTC offer from ${clientId} forwarded to ${data.payload.targetClientId}`,
      )
      return
    }

    if (data.type === 'webrtc_answer') {
      // Forward answer to broadcaster
      sendToClient(data.payload.targetClientId, {
        type: 'webrtc_answer',
        payload: {
          viewerId: clientId,
          targetClientId: data.payload.targetClientId,
          sdp: data.payload.sdp,
        },
      })
      wsLogger.debug(
        `WebRTC answer from ${clientId} forwarded to ${data.payload.targetClientId}`,
      )
      return
    }

    if (data.type === 'webrtc_ice_candidate') {
      // Forward ICE candidate to target
      sendToClient(data.payload.targetClientId, {
        type: 'webrtc_ice_candidate',
        payload: {
          fromClientId: clientId,
          targetClientId: data.payload.targetClientId,
          candidate: data.payload.candidate,
        },
      })
      wsLogger.debug(
        `ICE candidate from ${clientId} forwarded to ${data.payload.targetClientId}`,
      )
      return
    }
  } catch (error) {
    wsLogger.error(`Failed to parse message: ${error}`)
  }
}

/**
 * Handles WebSocket disconnections
 */
export function handleWebSocketClose(ws: ServerWebSocket<WebSocketData>) {
  // Check if the disconnecting client is the audio controller
  if (isAudioController(ws)) {
    unregisterAudioController(ws)
  }

  if (ws.data.clientId) {
    const clientId = ws.data.clientId
    clients.delete(clientId)
    wsLogger.info(`Client disconnected: ${clientId} (total: ${clients.size})`)

    // If the broadcaster disconnects, stop the screen share
    if (activeScreenShare?.broadcasterId === clientId) {
      const message = JSON.stringify({
        type: 'screen_share_stopped',
        payload: {
          broadcasterId: clientId,
          stoppedAt: Date.now(),
        },
      } satisfies ScreenShareStoppedMessage)

      activeScreenShare = null
      wsLogger.info(`Screen share stopped due to broadcaster disconnect`)

      // Clear presentation state
      const newState = clearTemporaryContent()

      for (const [id, conn] of clients) {
        try {
          conn.ws.send(message)
        } catch (error) {
          wsLogger.error(`Failed to send to ${id}: ${error}`)
          clients.delete(id)
        }
      }

      // Broadcast updated presentation state
      broadcastPresentationState(newState)
    }
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

  wsLogger.debug(`Broadcasting presentation_state to ${clients.size} clients`)

  for (const [clientId, conn] of clients) {
    try {
      conn.ws.send(message)
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

  for (const [clientId, conn] of clients) {
    try {
      conn.ws.send(message)
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

/**
 * Broadcasts slide highlights to all connected clients
 */
export function broadcastSlideHighlights(highlights: TextStyleRange[]) {
  const message = JSON.stringify({
    type: 'slide_highlights_updated',
    payload: {
      highlights,
      updatedAt: Date.now(),
    },
  } satisfies SlideHighlightsUpdatedMessage)

  wsLogger.debug(
    `Broadcasting slide highlights (${highlights.length}) to ${clients.size} clients`,
  )

  for (const [clientId, conn] of clients) {
    try {
      conn.ws.send(message)
    } catch (error) {
      wsLogger.error(`Failed to send to ${clientId}: ${error}`)
      clients.delete(clientId)
    }
  }
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

  for (const [clientId, conn] of clients) {
    try {
      conn.ws.send(message)
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

  for (const [clientId, conn] of clients) {
    try {
      conn.ws.send(message)
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

  for (const [clientId, conn] of clients) {
    try {
      conn.ws.send(message)
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

  for (const [clientId, conn] of clients) {
    try {
      conn.ws.send(message)
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

  wsLogger.info(
    `Broadcasting YouTube auth status to ${clients.size} clients: isAuthenticated=${status.isAuthenticated}`,
  )

  for (const [clientId, conn] of clients) {
    try {
      conn.ws.send(message)
    } catch (error) {
      wsLogger.error(`Failed to send to ${clientId}: ${error}`)
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

  for (const [clientId, conn] of clients) {
    try {
      conn.ws.send(message)
    } catch (error) {
      wsLogger.error(`Failed to send to ${clientId}: ${error}`)
      clients.delete(clientId)
    }
  }
}

// Settings message types
export type SettingsUpdatedMessage = {
  type: 'settings_updated'
  payload: {
    table: string
    key: string
    updatedAt: number
  }
}

/**
 * Broadcasts settings update to all connected clients
 */
export function broadcastSettingsUpdated(table: string, key: string) {
  const message = JSON.stringify({
    type: 'settings_updated',
    payload: {
      table,
      key,
      updatedAt: Date.now(),
    },
  } satisfies SettingsUpdatedMessage)

  wsLogger.debug(
    `Broadcasting settings update (${table}/${key}) to ${clients.size} clients`,
  )

  for (const [clientId, conn] of clients) {
    try {
      conn.ws.send(message)
    } catch (error) {
      wsLogger.error(`Failed to send to ${clientId}: ${error}`)
      clients.delete(clientId)
    }
  }
}

// Sidebar navigation message type
export type SidebarNavigationMessage = {
  type: 'sidebar_navigation'
  payload: {
    route: string
    focusSearch: boolean
  }
}

/**
 * Broadcasts sidebar navigation command to all connected clients
 * Used for MIDI shortcuts that navigate to sidebar pages
 */
export function broadcastSidebarNavigation(
  route: string,
  focusSearch: boolean,
) {
  const message = JSON.stringify({
    type: 'sidebar_navigation',
    payload: {
      route,
      focusSearch,
    },
  } satisfies SidebarNavigationMessage)

  wsLogger.debug(
    `Broadcasting sidebar navigation (${route}) to ${clients.size} clients`,
  )

  for (const [clientId, conn] of clients) {
    try {
      conn.ws.send(message)
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
    isReconnecting: boolean
    reconnectingInputDevice: string | null
    reconnectingOutputDevice: string | null
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

  for (const [clientId, conn] of clients) {
    try {
      conn.ws.send(wsMessage)
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

  for (const [clientId, conn] of clients) {
    try {
      conn.ws.send(message)
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

  for (const [clientId, conn] of clients) {
    try {
      conn.ws.send(message)
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

// Music Player message types
export type MusicPlayerStateMessage = {
  type: 'music_state'
  payload: {
    isPlaying: boolean
    currentTime: number
    duration: number
    volume: number
    isMuted: boolean
    isShuffled: boolean
    currentIndex: number
    queueLength: number
    currentTrack: {
      id: number
      fileId: number
      path: string
      filename: string
      title?: string
      artist?: string
      album?: string
      duration?: number
    } | null
    queue: Array<{
      id: number
      fileId: number
      filename: string
      title?: string
      artist?: string
      duration?: number
    }>
    updatedAt: number
  }
}

// Callback for handling Music Player WebSocket messages
let musicCommandHandler:
  | ((type: string, payload: Record<string, unknown>) => void)
  | null = null

/**
 * Register a handler for Music Player WebSocket messages from clients
 */
export function setMusicCommandHandler(
  handler: (type: string, payload: Record<string, unknown>) => void,
) {
  musicCommandHandler = handler
}

/**
 * Broadcasts music player state to all connected clients
 */
export function broadcastMusicState(state: MusicPlayerStateMessage['payload']) {
  const message = JSON.stringify({
    type: 'music_state',
    payload: state,
  } satisfies MusicPlayerStateMessage)

  wsLogger.debug(`Broadcasting music state to ${clients.size} clients`)

  for (const [clientId, conn] of clients) {
    try {
      conn.ws.send(message)
    } catch (error) {
      wsLogger.error(`Failed to send to ${clientId}: ${error}`)
      clients.delete(clientId)
    }
  }
}
