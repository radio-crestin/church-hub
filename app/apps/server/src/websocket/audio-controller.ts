import type { ServerWebSocket } from 'bun'

import type { WebSocketData } from './index'
import { wsLogger } from '../utils/fileLogger'

/**
 * Audio command messages sent to Tauri audio controller
 */
export type AudioCommandMessage =
  | { type: 'audio_load'; payload: { path: string } }
  | { type: 'audio_play' }
  | { type: 'audio_pause' }
  | { type: 'audio_stop' }
  | { type: 'audio_seek'; payload: { time: number } }
  | { type: 'audio_volume'; payload: { level: number } }
  | { type: 'audio_mute'; payload: { muted: boolean } }

/**
 * Audio state update from Tauri audio controller
 */
export interface AudioStatePayload {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  isLoading: boolean
  error?: string
  updatedAt: number
}

/**
 * Audio finished notification from Tauri audio controller
 */
export interface AudioFinishedPayload {
  reason: 'eof' | 'error' | 'stopped'
  error?: string
  finishedAt: number
}

interface AudioControllerState {
  ws: ServerWebSocket<WebSocketData> | null
  isConnected: boolean
  lastStateUpdate: AudioStatePayload | null
  connectedAt: number | null
}

const audioController: AudioControllerState = {
  ws: null,
  isConnected: false,
  lastStateUpdate: null,
  connectedAt: null,
}

// Callback to notify when audio finishes (for next track logic)
let audioFinishedCallback: ((reason: string, error?: string) => void) | null =
  null

// Callback to notify when audio state updates
let audioStateCallback: ((state: AudioStatePayload) => void) | null = null

/**
 * Set callback for when audio finishes playing
 */
export function setAudioFinishedCallback(
  callback: (reason: string, error?: string) => void,
): void {
  audioFinishedCallback = callback
}

/**
 * Set callback for when audio state updates
 */
export function setAudioStateCallback(
  callback: (state: AudioStatePayload) => void,
): void {
  audioStateCallback = callback
}

/**
 * Register a WebSocket connection as the audio controller
 */
export function registerAudioController(
  ws: ServerWebSocket<WebSocketData>,
): void {
  // If there's already a controller, disconnect the old one
  if (audioController.ws && audioController.ws !== ws) {
    wsLogger.warn(
      '[AudioController] Replacing existing audio controller connection',
    )
  }

  audioController.ws = ws
  audioController.isConnected = true
  audioController.connectedAt = Date.now()
  wsLogger.info('[AudioController] Tauri audio controller registered')
}

/**
 * Unregister the audio controller when it disconnects
 */
export function unregisterAudioController(
  ws: ServerWebSocket<WebSocketData>,
): void {
  if (audioController.ws === ws) {
    audioController.ws = null
    audioController.isConnected = false
    audioController.lastStateUpdate = null
    audioController.connectedAt = null
    wsLogger.info('[AudioController] Tauri audio controller disconnected')
  }
}

/**
 * Check if the audio controller is connected
 */
export function isAudioControllerConnected(): boolean {
  return audioController.isConnected && audioController.ws !== null
}

/**
 * Send a command to the audio controller
 */
export function sendAudioCommand(command: AudioCommandMessage): boolean {
  if (!audioController.ws || !audioController.isConnected) {
    wsLogger.warn(
      '[AudioController] Cannot send command - controller not connected',
    )
    return false
  }

  try {
    audioController.ws.send(JSON.stringify(command))
    wsLogger.debug(`[AudioController] Sent command: ${command.type}`)
    return true
  } catch (error) {
    wsLogger.error(`[AudioController] Failed to send command: ${error}`)
    return false
  }
}

/**
 * Handle messages from the audio controller
 */
export function handleAudioControllerMessage(data: {
  type: string
  payload?: unknown
}): void {
  if (data.type === 'audio_state_update') {
    const payload = data.payload as AudioStatePayload
    audioController.lastStateUpdate = payload
    audioStateCallback?.(payload)
  }

  if (data.type === 'audio_finished') {
    const { reason, error } = data.payload as AudioFinishedPayload
    wsLogger.info(`[AudioController] Audio finished: ${reason}`)
    audioFinishedCallback?.(reason, error)
  }
}

/**
 * Get the last known audio state
 */
export function getAudioControllerState(): AudioStatePayload | null {
  return audioController.lastStateUpdate
}

/**
 * Check if a WebSocket connection is the audio controller
 */
export function isAudioController(ws: ServerWebSocket<WebSocketData>): boolean {
  return audioController.ws === ws
}
