/**
 * Stream Control Service
 * Provides reusable functions for starting/stopping streams
 * Used by both API endpoints and MIDI shortcuts
 */

import { startStreaming, stopStreaming, switchScene } from './obs'
import { obsConnection } from './obs/websocket-client'
import {
  clearActiveBroadcastCache,
  createBroadcast,
  endBroadcast,
  getActiveBroadcast,
  getYouTubeConfig,
} from './youtube'
import {
  broadcastLivestreamStatus,
  broadcastOBSCurrentScene,
  broadcastOBSStreamingStatus,
  broadcastStreamStartProgress,
} from '../../websocket'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [stream-control] ${message}`)
}

// Mutex to prevent concurrent stream start requests
let streamStartInProgress = false

/**
 * Check if stream start is currently in progress
 */
export function isStreamStartInProgress(): boolean {
  return streamStartInProgress
}

/**
 * Start the livestream
 * Handles the full flow: scene switch, YouTube broadcast creation, OBS streaming
 * Broadcasts progress via WebSocket so UI can display status
 */
export async function startStream(): Promise<{
  success: boolean
  error?: string
  broadcast?: {
    broadcastId: string
    url: string
    title: string
  }
}> {
  // Prevent concurrent stream start requests
  if (streamStartInProgress) {
    log('warning', 'Stream start already in progress')
    return { success: false, error: 'Stream start already in progress' }
  }

  streamStartInProgress = true

  try {
    const youtubeConfig = await getYouTubeConfig()
    const obsStatus = obsConnection.getConnectionStatus()

    // Step 1: Switch to start scene if configured (only if OBS is connected)
    if (youtubeConfig.startSceneName && obsStatus.connected) {
      await switchScene(youtubeConfig.startSceneName)
      broadcastOBSCurrentScene(youtubeConfig.startSceneName)
    }

    // Step 2: Create YouTube broadcast
    broadcastStreamStartProgress({
      step: 'creating_broadcast',
      progress: 5,
      message: 'Creating YouTube broadcast...',
      updatedAt: Date.now(),
    })

    const broadcast = await createBroadcast()

    // Step 3: Wait 5 seconds for YouTube to process the broadcast
    for (let i = 5; i > 0; i--) {
      broadcastStreamStartProgress({
        step: 'delay_before_stream',
        progress: 15 + (5 - i) * 15,
        message: `Starting in ${i} seconds...`,
        broadcastId: broadcast.broadcastId,
        updatedAt: Date.now(),
      })
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    // Step 4: Start OBS streaming (only if OBS is connected)
    const currentObsStatus = obsConnection.getConnectionStatus()
    if (currentObsStatus.connected) {
      broadcastStreamStartProgress({
        step: 'starting_obs',
        progress: 90,
        message: 'Starting OBS stream...',
        broadcastId: broadcast.broadcastId,
        updatedAt: Date.now(),
      })

      try {
        await startStreaming()
      } catch (obsError) {
        const obsErrorMessage =
          obsError instanceof Error ? obsError.message : 'Failed to start OBS'
        broadcastStreamStartProgress({
          step: 'error',
          progress: 0,
          message: 'Failed to start OBS streaming',
          error: obsErrorMessage,
          updatedAt: Date.now(),
        })
        return { success: false, error: obsErrorMessage }
      }
    } else {
      // OBS not connected - broadcast error
      broadcastStreamStartProgress({
        step: 'error',
        progress: 0,
        message: 'OBS is not connected',
        error: 'Please connect to OBS first',
        updatedAt: Date.now(),
      })
      return { success: false, error: 'OBS is not connected' }
    }

    // Step 5: Complete
    broadcastStreamStartProgress({
      step: 'completed',
      progress: 100,
      message: 'Stream started successfully!',
      broadcastId: broadcast.broadcastId,
      updatedAt: Date.now(),
    })

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

    // Clear cache so next query fetches fresh data
    clearActiveBroadcastCache()

    return {
      success: true,
      broadcast: {
        broadcastId: broadcast.broadcastId,
        url: broadcast.url,
        title: broadcast.title,
      },
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to start stream'

    broadcastStreamStartProgress({
      step: 'error',
      progress: 0,
      message: 'Stream start failed',
      error: errorMessage,
      updatedAt: Date.now(),
    })

    return { success: false, error: errorMessage }
  } finally {
    streamStartInProgress = false
  }
}

/**
 * Stop the livestream
 * Handles the full flow: OBS stop, YouTube broadcast end, scene switch
 * Broadcasts status via WebSocket so UI can display status
 */
export async function stopStream(): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // Get the active broadcast BEFORE stopping OBS streaming
    const activeBroadcast = await getActiveBroadcast()

    // Only stop OBS streaming if OBS is connected
    const obsStatus = obsConnection.getConnectionStatus()
    if (obsStatus.connected) {
      await stopStreaming()
    }

    if (activeBroadcast) {
      await endBroadcast(activeBroadcast.broadcastId)
    }

    const youtubeConfig = await getYouTubeConfig()
    if (youtubeConfig.stopSceneName && obsStatus.connected) {
      await switchScene(youtubeConfig.stopSceneName)
      broadcastOBSCurrentScene(youtubeConfig.stopSceneName)
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

    // Clear cache so next query fetches fresh data
    clearActiveBroadcastCache()

    return { success: true }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to stop stream'
    return { success: false, error: errorMessage }
  }
}

/**
 * Toggle the livestream
 * Starts if not live, stops if live
 */
export async function toggleStream(): Promise<{
  success: boolean
  error?: string
  action?: 'start' | 'stop'
}> {
  const streamingStatus = obsConnection.getStreamingStatus()

  if (streamingStatus.isStreaming) {
    const result = await stopStream()
    return { ...result, action: 'stop' }
  } else {
    const result = await startStream()
    return { ...result, action: 'start' }
  }
}
