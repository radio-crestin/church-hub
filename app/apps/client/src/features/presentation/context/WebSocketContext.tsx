import { useQueryClient } from '@tanstack/react-query'
import TauriWebSocket from '@tauri-apps/plugin-websocket'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { getApiUrl, getWsUrl, isMobile } from '~/config'
import { getStoredUserToken } from '~/service/api-url'
import { createLogger } from '~/utils/logger'
import { updateStateIfNewer } from '../hooks/usePresentationControls'
import { presentationStateQueryKey } from '../hooks/usePresentationState'
import { screenQueryKey } from '../hooks/useScreen'
import { slideHighlightsQueryKey } from '../hooks/useSlideHighlights'
import type { PresentationState } from '../types'

const logger = createLogger('WebSocket')

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface WebSocketDebugInfo {
  status: WebSocketStatus
  url: string | null
  messageCount: number
  presentationStateCount: number
  lastMessageAt: number | null
  lastPresentationUpdatedAt: number | null
  lastSlideIndex: number | null
  staleMessagesBlocked: number
  missedPongs: number
  disconnectCount: number
}

interface PresentationMessage {
  type: 'presentation_state'
  payload: PresentationState
}

interface ScreenConfigUpdatedMessage {
  type: 'screen_config_updated'
  payload: {
    screenId: number
    updatedAt: number
  }
}

interface ScreenConfigPreviewMessage {
  type: 'screen_config_preview'
  payload: {
    screenId: number
    config: Record<string, unknown>
    updatedAt: number
  }
}

interface HighlightColorsUpdatedMessage {
  type: 'highlight_colors_updated'
  payload: {
    colors: Array<{
      id: number
      name: string
      color: string
      sortOrder: number
    }>
  }
}

interface SlideHighlightsUpdatedMessage {
  type: 'slide_highlights_updated'
  payload: {
    highlights: Array<{
      id: string
      start: number
      end: number
      highlight?: string
      bold?: boolean
      underline?: boolean
    }>
    updatedAt: number
  }
}

interface SettingsUpdatedMessage {
  type: 'settings_updated'
  payload: {
    table: string
    key: string
    updatedAt: number
  }
}

interface MusicStateMessage {
  type: 'music_state'
  payload: {
    isPlaying: boolean
    currentTime: number
    duration: number
    volume: number
    isMuted: boolean
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

interface SidebarNavigationMessage {
  type: 'sidebar_navigation'
  payload: {
    route: string
    focusSearch: boolean
  }
}

// Screen share message types (for WebRTC signaling)
interface ScreenShareStartedMessage {
  type: 'screen_share_started'
  payload: {
    broadcasterId: string
    audioEnabled: boolean
    startedAt: number
  }
}

interface ScreenShareStoppedMessage {
  type: 'screen_share_stopped'
  payload: {
    broadcasterId: string
    stoppedAt: number
    stoppedBy?: string
  }
}

interface ScreenShareJoinRequestMessage {
  type: 'screen_share_join_request'
  payload: {
    viewerId: string
  }
}

interface WebRTCOfferMessage {
  type: 'webrtc_offer'
  payload: {
    broadcasterId: string
    targetClientId: string
    sdp: string
  }
}

interface WebRTCAnswerMessage {
  type: 'webrtc_answer'
  payload: {
    viewerId: string
    targetClientId: string
    sdp: string
  }
}

interface WebRTCIceCandidateMessage {
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

type MessageData =
  | PresentationMessage
  | ScreenConfigUpdatedMessage
  | ScreenConfigPreviewMessage
  | HighlightColorsUpdatedMessage
  | SlideHighlightsUpdatedMessage
  | SettingsUpdatedMessage
  | MusicStateMessage
  | SidebarNavigationMessage
  | ScreenShareStartedMessage
  | ScreenShareStoppedMessage
  | ScreenShareJoinRequestMessage
  | WebRTCOfferMessage
  | WebRTCAnswerMessage
  | WebRTCIceCandidateMessage
  | { type: 'pong' }

// Check if we should use Tauri WebSocket plugin (on mobile)
const useTauriWebSocket = isMobile()

// Ping configuration for connection health check
const PING_INTERVAL_MS = 3000 // Send ping every 3 seconds
const PONG_TIMEOUT_MS = 2000 // Wait 2 seconds for pong response
const MAX_MISSED_PONGS = 3 // After 3 missed pongs, consider connection dead

interface WebSocketContextValue {
  status: WebSocketStatus
  send: (message: Record<string, unknown>) => Promise<boolean>
  debugInfo: WebSocketDebugInfo
  songUpdateTimestamp: number | null
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null)

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  // For native WebSocket (desktop/browser)
  const nativeWsRef = useRef<WebSocket | null>(null)
  // For Tauri WebSocket (mobile)
  const tauriWsRef = useRef<TauriWebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pongTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const missedPongsRef = useRef(0)
  const disconnectCountRef = useRef(0)
  const hasCountedDisconnectRef = useRef(false)
  const [status, setStatus] = useState<WebSocketStatus>('disconnected')
  const [songUpdateTimestamp, setSongUpdateTimestamp] = useState<number | null>(
    null,
  )
  const isConnectingRef = useRef(false)

  // Debug info state
  const [debugInfo, setDebugInfo] = useState<WebSocketDebugInfo>({
    status: 'disconnected',
    url: null,
    messageCount: 0,
    presentationStateCount: 0,
    lastMessageAt: null,
    lastPresentationUpdatedAt: null,
    lastSlideIndex: null,
    staleMessagesBlocked: 0,
    missedPongs: 0,
    disconnectCount: 0,
  })

  const handleMessage = useCallback(
    (messageData: string) => {
      try {
        const data = JSON.parse(messageData) as MessageData

        if (data.type === 'pong') {
          // Reset missed pongs counter on successful pong
          missedPongsRef.current = 0
          setDebugInfo((prev) => ({ ...prev, missedPongs: 0 }))
          // Clear pong timeout
          if (pongTimeoutRef.current) {
            clearTimeout(pongTimeoutRef.current)
            pongTimeoutRef.current = null
          }
          return
        }

        // Update debug info for all non-pong messages
        setDebugInfo((prev) => ({
          ...prev,
          messageCount: prev.messageCount + 1,
          lastMessageAt: Date.now(),
        }))

        if (data.type === 'presentation_state') {
          const wasApplied = updateStateIfNewer(queryClient, data.payload)

          // Extract slide index from temporary content if present
          let slideIndex: number | null = null
          if (data.payload.temporaryContent?.type === 'song') {
            slideIndex = data.payload.temporaryContent.data.currentSlideIndex
          }

          setDebugInfo((prev) => ({
            ...prev,
            presentationStateCount: prev.presentationStateCount + 1,
            lastPresentationUpdatedAt: data.payload.updatedAt,
            lastSlideIndex: slideIndex,
            staleMessagesBlocked: wasApplied
              ? prev.staleMessagesBlocked
              : prev.staleMessagesBlocked + 1,
          }))
        }

        if (data.type === 'screen_config_updated') {
          queryClient.invalidateQueries({
            queryKey: screenQueryKey(data.payload.screenId),
          })
        }

        if (data.type === 'screen_config_preview') {
          queryClient.setQueryData(
            screenQueryKey(data.payload.screenId),
            data.payload.config,
          )
        }

        if (data.type === 'settings_updated') {
          // Force immediate refetch when settings are updated
          if (data.payload.key === 'selected_bible_translations') {
            queryClient.refetchQueries({
              queryKey: ['settings', 'selected_bible_translations'],
            })
            queryClient.refetchQueries({
              queryKey: ['bible'],
            })
          }

          if (data.payload.key === 'global_keyboard_shortcuts') {
            queryClient.invalidateQueries({
              queryKey: ['app_settings', 'global_keyboard_shortcuts'],
            })
          }
        }

        if (data.type === 'song_updated') {
          // Invalidate the specific song query to trigger refetch
          queryClient.invalidateQueries({
            queryKey: ['song', data.payload.songId],
          })
          // Also invalidate the songs list to update any list views
          queryClient.invalidateQueries({
            queryKey: ['songs'],
          })
          // Invalidate all schedule queries to update slides in schedule panels
          queryClient.invalidateQueries({
            queryKey: ['schedule'],
          })
          // Update timestamp to trigger refetch in components that use queue data
          setSongUpdateTimestamp(data.payload.updatedAt)
        }

        if (data.type === 'slide_highlights_updated') {
          queryClient.setQueryData(
            slideHighlightsQueryKey,
            data.payload.highlights,
          )
        }

        if (data.type === 'music_state') {
          queryClient.setQueryData(['music', 'playerState'], data.payload)
        }

        if (data.type === 'sidebar_navigation') {
          window.dispatchEvent(
            new CustomEvent('sidebar-navigation', {
              detail: {
                route: data.payload.route,
                focusSearch: data.payload.focusSearch,
              },
            }),
          )
        }

        // Handle screen share WebRTC signaling messages
        if (
          data.type === 'screen_share_started' ||
          data.type === 'screen_share_stopped' ||
          data.type === 'screen_share_join_request' ||
          data.type === 'webrtc_offer' ||
          data.type === 'webrtc_answer' ||
          data.type === 'webrtc_ice_candidate'
        ) {
          window.dispatchEvent(
            new CustomEvent('screen-share-message', {
              detail: data,
            }),
          )
        }
      } catch {
        // Failed to parse message
      }
    },
    [queryClient],
  )

  const connectNative = useCallback(() => {
    if (nativeWsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    // Get WebSocket URL
    let wsUrl = getWsUrl()
    if (!wsUrl) {
      const apiUrl = getApiUrl()
      if (!apiUrl) {
        setStatus('error')
        setDebugInfo((prev) => ({ ...prev, status: 'error' }))
        return
      }
      wsUrl = apiUrl.replace(/^http/, 'ws')
    }
    wsUrl = wsUrl + '/ws'

    setStatus('connecting')
    setDebugInfo((prev) => ({ ...prev, status: 'connecting', url: wsUrl }))

    try {
      const ws = new WebSocket(wsUrl)
      nativeWsRef.current = ws

      ws.onopen = () => {
        setStatus('connected')
        missedPongsRef.current = 0
        disconnectCountRef.current = 0
        hasCountedDisconnectRef.current = false
        setDebugInfo((prev) => ({
          ...prev,
          status: 'connected',
          missedPongs: 0,
          disconnectCount: 0,
        }))

        // Invalidate presentation state to refetch current state on reconnection
        queryClient.invalidateQueries({ queryKey: presentationStateQueryKey })

        // Start ping interval with 3-strike rule
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))

            // Start timeout to wait for pong
            pongTimeoutRef.current = setTimeout(() => {
              missedPongsRef.current++
              setDebugInfo((prev) => ({
                ...prev,
                missedPongs: missedPongsRef.current,
              }))
              logger.debug(
                `Missed pong ${missedPongsRef.current}/${MAX_MISSED_PONGS}`,
              )

              if (missedPongsRef.current >= MAX_MISSED_PONGS) {
                logger.debug('Connection lost - 3 pongs missed')
                if (!hasCountedDisconnectRef.current) {
                  hasCountedDisconnectRef.current = true
                  disconnectCountRef.current++
                  setDebugInfo((prev) => ({
                    ...prev,
                    disconnectCount: disconnectCountRef.current,
                  }))
                }
                setStatus('disconnected')

                if (pingIntervalRef.current) {
                  clearInterval(pingIntervalRef.current)
                  pingIntervalRef.current = null
                }

                ws.close()
              }
            }, PONG_TIMEOUT_MS)
          }
        }, PING_INTERVAL_MS)
      }

      ws.onmessage = (event) => {
        handleMessage(event.data)
      }

      ws.onerror = () => {
        missedPongsRef.current++
        if (!hasCountedDisconnectRef.current) {
          hasCountedDisconnectRef.current = true
          disconnectCountRef.current++
        }
        setStatus('error')
        setDebugInfo((prev) => ({
          ...prev,
          status: 'error',
          missedPongs: missedPongsRef.current,
          disconnectCount: disconnectCountRef.current,
        }))

        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null
            connectNative()
          }, 3000)
        }
      }

      ws.onclose = () => {
        if (!hasCountedDisconnectRef.current) {
          hasCountedDisconnectRef.current = true
          disconnectCountRef.current++
        }
        setStatus('disconnected')
        setDebugInfo((prev) => ({
          ...prev,
          status: 'disconnected',
          disconnectCount: disconnectCountRef.current,
        }))

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }

        if (pongTimeoutRef.current) {
          clearTimeout(pongTimeoutRef.current)
          pongTimeoutRef.current = null
        }

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null
          connectNative()
        }, 3000)
      }
    } catch {
      missedPongsRef.current++
      if (!hasCountedDisconnectRef.current) {
        hasCountedDisconnectRef.current = true
        disconnectCountRef.current++
      }
      setStatus('error')
      setDebugInfo((prev) => ({
        ...prev,
        status: 'error',
        missedPongs: missedPongsRef.current,
        disconnectCount: disconnectCountRef.current,
      }))

      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null
        connectNative()
      }, 5000)
    }
  }, [handleMessage, queryClient])

  const connectTauri = useCallback(async () => {
    if (isConnectingRef.current) {
      return
    }

    if (tauriWsRef.current) {
      return
    }

    isConnectingRef.current = true

    // Get WebSocket URL
    let wsUrl = getWsUrl()
    if (!wsUrl) {
      const apiUrl = getApiUrl()
      if (!apiUrl) {
        setStatus('error')
        isConnectingRef.current = false
        return
      }
      wsUrl = apiUrl.replace(/^http/, 'ws')
    }
    wsUrl = wsUrl + '/ws'

    // Add auth token as query parameter
    const token = getStoredUserToken()
    if (token) {
      wsUrl = `${wsUrl}?token=${encodeURIComponent(token)}`
    }

    setStatus('connecting')
    setDebugInfo((prev) => ({ ...prev, status: 'connecting', url: wsUrl }))

    try {
      const ws = await TauriWebSocket.connect(wsUrl)
      tauriWsRef.current = ws
      isConnectingRef.current = false

      setStatus('connected')
      missedPongsRef.current = 0
      disconnectCountRef.current = 0
      hasCountedDisconnectRef.current = false
      setDebugInfo((prev) => ({
        ...prev,
        status: 'connected',
        missedPongs: 0,
        disconnectCount: 0,
      }))

      // Invalidate presentation state to refetch current state on reconnection
      queryClient.invalidateQueries({ queryKey: presentationStateQueryKey })

      // Listen for messages and connection events
      ws.addListener((message) => {
        // Handle close event from Tauri WebSocket
        if (message.type === 'Close') {
          logger.debug('Tauri WebSocket closed')
          if (!hasCountedDisconnectRef.current) {
            hasCountedDisconnectRef.current = true
            disconnectCountRef.current++
          }
          setStatus('disconnected')
          setDebugInfo((prev) => ({
            ...prev,
            status: 'disconnected',
            disconnectCount: disconnectCountRef.current,
          }))
          tauriWsRef.current = null

          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current)
            pingIntervalRef.current = null
          }

          if (pongTimeoutRef.current) {
            clearTimeout(pongTimeoutRef.current)
            pongTimeoutRef.current = null
          }

          // Reconnect after delay
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null
            connectTauri()
          }, 3000)
          return
        }

        // Handle text/binary messages
        if (typeof message.data === 'string') {
          handleMessage(message.data)
        } else if (message.data instanceof ArrayBuffer) {
          const text = new TextDecoder().decode(message.data)
          handleMessage(text)
        }
      })

      // Helper function to handle connection loss
      const handleConnectionLost = async () => {
        logger.debug('Connection lost - 3 pongs missed')
        if (!hasCountedDisconnectRef.current) {
          hasCountedDisconnectRef.current = true
          disconnectCountRef.current++
        }
        setStatus('disconnected')
        setDebugInfo((prev) => ({
          ...prev,
          status: 'disconnected',
          disconnectCount: disconnectCountRef.current,
        }))

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }

        if (pongTimeoutRef.current) {
          clearTimeout(pongTimeoutRef.current)
          pongTimeoutRef.current = null
        }

        if (tauriWsRef.current) {
          try {
            await tauriWsRef.current.disconnect()
          } catch {
            // Ignore disconnect errors
          }
          tauriWsRef.current = null
        }

        // Reconnect after delay
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null
          connectTauri()
        }, 3000)
      }

      // Start ping interval with 3-strike rule
      pingIntervalRef.current = setInterval(async () => {
        if (tauriWsRef.current) {
          try {
            await tauriWsRef.current.send(JSON.stringify({ type: 'ping' }))

            // Start timeout to wait for pong
            pongTimeoutRef.current = setTimeout(() => {
              missedPongsRef.current++
              setDebugInfo((prev) => ({
                ...prev,
                missedPongs: missedPongsRef.current,
              }))
              logger.debug(
                `Missed pong ${missedPongsRef.current}/${MAX_MISSED_PONGS}`,
              )

              if (missedPongsRef.current >= MAX_MISSED_PONGS) {
                handleConnectionLost()
              }
            }, PONG_TIMEOUT_MS)
          } catch {
            // Ping send failed - count as missed pong
            missedPongsRef.current++
            setDebugInfo((prev) => ({
              ...prev,
              missedPongs: missedPongsRef.current,
            }))
            logger.debug(
              `Ping send failed ${missedPongsRef.current}/${MAX_MISSED_PONGS}`,
            )

            if (missedPongsRef.current >= MAX_MISSED_PONGS) {
              handleConnectionLost()
            }
          }
        }
      }, PING_INTERVAL_MS)
    } catch {
      isConnectingRef.current = false
      missedPongsRef.current++
      if (!hasCountedDisconnectRef.current) {
        hasCountedDisconnectRef.current = true
        disconnectCountRef.current++
      }
      setStatus('error')
      setDebugInfo((prev) => ({
        ...prev,
        status: 'error',
        missedPongs: missedPongsRef.current,
        disconnectCount: disconnectCountRef.current,
      }))

      // Retry connection
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null
        connectTauri()
      }, 3000)
    }
  }, [handleMessage, queryClient])

  const connect = useCallback(() => {
    if (useTauriWebSocket) {
      connectTauri()
    } else {
      connectNative()
    }
  }, [connectTauri, connectNative])

  const disconnect = useCallback(async () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }

    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current)
      pongTimeoutRef.current = null
    }

    if (useTauriWebSocket) {
      if (tauriWsRef.current) {
        try {
          await tauriWsRef.current.disconnect()
        } catch {
          // Failed to disconnect
        }
        tauriWsRef.current = null
      }
    } else {
      if (nativeWsRef.current) {
        nativeWsRef.current.close()
        nativeWsRef.current = null
      }
    }
  }, [])

  const send = useCallback(async (message: Record<string, unknown>) => {
    const messageStr = JSON.stringify(message)

    if (useTauriWebSocket) {
      if (tauriWsRef.current) {
        try {
          await tauriWsRef.current.send(messageStr)
          return true
        } catch {
          return false
        }
      }
    } else {
      if (nativeWsRef.current?.readyState === WebSocket.OPEN) {
        nativeWsRef.current.send(messageStr)
        return true
      }
    }

    return false
  }, [])

  // Use refs for connect/disconnect to avoid dependency array issues
  const connectRef = useRef(connect)
  const disconnectRef = useRef(disconnect)
  connectRef.current = connect
  disconnectRef.current = disconnect

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connectRef.current()

    return () => {
      disconnectRef.current()
    }
  }, []) // Empty dependency - only run on mount/unmount

  const value = useMemo(
    () => ({
      status,
      send,
      debugInfo,
      songUpdateTimestamp,
    }),
    [status, send, debugInfo, songUpdateTimestamp],
  )

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error(
      'useWebSocketContext must be used within a WebSocketProvider',
    )
  }
  return context
}

/**
 * Hook to get the song update timestamp.
 * Use this to trigger refetches when a song is updated via WebSocket.
 * This is a lightweight hook that avoids the re-renders from debug info updates.
 */
export function useSongUpdateTimestamp() {
  const context = useContext(WebSocketContext)
  return context?.songUpdateTimestamp ?? null
}
