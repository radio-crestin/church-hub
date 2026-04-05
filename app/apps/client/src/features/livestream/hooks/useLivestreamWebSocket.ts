import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { createLogger } from '~/utils/logger'
import { getApiUrl } from '../../../config'
import type {
  LivestreamStatus,
  OBSConnectionStatus,
  OBSStreamingStatus,
  StreamStartProgress,
} from '../types'

const logger = createLogger('app:livestream:ws')

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface OBSConnectionStatusMessage {
  type: 'obs_connection_status'
  payload: OBSConnectionStatus
}

interface OBSStreamingStatusMessage {
  type: 'obs_streaming_status'
  payload: OBSStreamingStatus
}

interface OBSCurrentSceneMessage {
  type: 'obs_current_scene'
  payload: {
    sceneName: string
    updatedAt: number
  }
}

interface LivestreamStatusMessage {
  type: 'livestream_status'
  payload: LivestreamStatus
}

interface YouTubeAuthStatusMessage {
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

interface StreamStartProgressMessage {
  type: 'stream_start_progress'
  payload: StreamStartProgress
}

type LivestreamMessage =
  | OBSConnectionStatusMessage
  | OBSStreamingStatusMessage
  | OBSCurrentSceneMessage
  | LivestreamStatusMessage
  | YouTubeAuthStatusMessage
  | StreamStartProgressMessage
  | { type: 'pong' }

export function useLivestreamWebSocket() {
  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [status, setStatus] = useState<WebSocketStatus>('disconnected')
  const [livestreamStatus, setLivestreamStatus] =
    useState<LivestreamStatus | null>(null)
  const [streamStartProgress, setStreamStartProgress] =
    useState<StreamStartProgress | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    const apiUrl = getApiUrl()
    const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws'

    logger.debug(`Connecting to ${wsUrl}`)
    setStatus('connecting')

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        logger.info(`WebSocket connected to ${wsUrl}`)
        setStatus('connected')

        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 30000)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as LivestreamMessage

          if (data.type === 'pong') {
            logger.debug('Received pong')
            return
          }

          if (data.type === 'obs_connection_status') {
            logger.debug('Received OBS connection status update')
            queryClient.invalidateQueries({
              queryKey: ['livestream', 'obs', 'status'],
            })
          }

          if (data.type === 'obs_streaming_status') {
            logger.debug('Received OBS streaming status update')
            queryClient.invalidateQueries({
              queryKey: ['livestream', 'obs', 'status'],
            })
          }

          if (data.type === 'obs_current_scene') {
            const sceneName = data.payload.sceneName
            logger.debug(`Received OBS current scene: ${sceneName}`)

            // Optimistic update - immediately mark this scene as current in cache
            // This ensures LED feedback reacts instantly without waiting for query refetch
            // Critical for Windows where MIDI timing differs from macOS
            for (const visibleOnly of [false, true]) {
              queryClient.setQueryData(
                ['livestream', 'obs', 'scenes', visibleOnly],
                (
                  old:
                    | Array<{ obsSceneName: string; isCurrent: boolean }>
                    | undefined,
                ) => {
                  if (!old) return old
                  return old.map((scene) => ({
                    ...scene,
                    isCurrent: scene.obsSceneName === sceneName,
                  }))
                },
              )
            }

            // Still invalidate to ensure eventual consistency with server
            queryClient.invalidateQueries({
              queryKey: ['livestream', 'obs', 'scenes'],
            })
          }

          if (data.type === 'livestream_status') {
            logger.debug('Received livestream status update')
            setLivestreamStatus(data.payload)
            queryClient.invalidateQueries({
              queryKey: ['livestream', 'broadcast'],
            })
          }

          if (data.type === 'youtube_auth_status') {
            logger.info(
              `Received YouTube auth status update: isAuthenticated=${data.payload.isAuthenticated}`,
            )
            logger.debug('YouTube auth status payload:', data.payload)
            queryClient.invalidateQueries({
              queryKey: ['livestream', 'youtube', 'auth'],
            })
          }

          if (data.type === 'stream_start_progress') {
            logger.debug(
              `Stream start progress: ${data.payload.step} (${data.payload.progress}%)`,
            )
            setStreamStartProgress(data.payload)

            if (data.payload.step === 'completed') {
              setTimeout(() => setStreamStartProgress(null), 3000)
            }
            // Error state stays visible until manually cleared via clearStreamStartProgress
          }
        } catch (error) {
          logger.error(`Failed to parse message: ${error}`)
        }
      }

      ws.onerror = (error) => {
        logger.error(`WebSocket error: ${error}`)
        setStatus('error')
      }

      ws.onclose = () => {
        logger.info('WebSocket disconnected')
        setStatus('disconnected')

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          logger.debug('Attempting reconnect...')
          connect()
        }, 3000)
      }
    } catch (error) {
      logger.error(`Failed to connect: ${error}`)
      setStatus('error')

      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, 5000)
    }
  }, [queryClient])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const clearStreamStartProgress = useCallback(() => {
    setStreamStartProgress(null)
  }, [])

  // Use refs for connect/disconnect to avoid dependency array issues
  const connectRef = useRef(connect)
  const disconnectRef = useRef(disconnect)
  connectRef.current = connect
  disconnectRef.current = disconnect

  useEffect(() => {
    connectRef.current()

    return () => {
      disconnectRef.current()
    }
  }, []) // Empty dependency - only run on mount/unmount

  return {
    status,
    livestreamStatus,
    streamStartProgress,
    clearStreamStartProgress,
    connect,
    disconnect,
  }
}
