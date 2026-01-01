import { useQueryClient } from '@tanstack/react-query'
import TauriWebSocket from '@tauri-apps/plugin-websocket'
import { useCallback, useEffect, useRef, useState } from 'react'

import { getApiUrl, getWsUrl, isMobile } from '~/config'
import { getStoredUserToken } from '~/service/api-url'
import { createLogger } from '~/utils/logger'
import { updateStateIfNewer } from './usePresentationControls'
import { presentationStateQueryKey } from './usePresentationState'
import { screenQueryKey } from './useScreen'
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

interface SettingsUpdatedMessage {
  type: 'settings_updated'
  payload: {
    table: string
    key: string
    updatedAt: number
  }
}

type MessageData =
  | PresentationMessage
  | ScreenConfigUpdatedMessage
  | ScreenConfigPreviewMessage
  | HighlightColorsUpdatedMessage
  | SettingsUpdatedMessage
  | { type: 'pong' }

// Check if we should use Tauri WebSocket plugin (on mobile)
const useTauriWebSocket = isMobile()

// Ping configuration for connection health check
const PING_INTERVAL_MS = 3000 // Send ping every 3 seconds
const PONG_TIMEOUT_MS = 2000 // Wait 2 seconds for pong response
const MAX_MISSED_PONGS = 3 // After 3 missed pongs, consider connection dead

export function useWebSocket() {
  const queryClient = useQueryClient()
  // For native WebSocket (desktop/browser)
  const nativeWsRef = useRef<WebSocket | null>(null)
  // For Tauri WebSocket (mobile)
  const tauriWsRef = useRef<TauriWebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pongTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const missedPongsRef = useRef(0)
  const [status, setStatus] = useState<WebSocketStatus>('disconnected')
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
            // Use refetchQueries to force immediate refetch, not just invalidate
            queryClient.refetchQueries({
              queryKey: ['settings', 'selected_bible_translations'],
            })
            // Also refetch Bible books/verses queries so they use the new translation
            queryClient.refetchQueries({
              queryKey: ['bible'],
            })
          }
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
        setDebugInfo((prev) => ({
          ...prev,
          status: 'connected',
          missedPongs: 0,
        }))
        missedPongsRef.current = 0

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
        setStatus('error')
        // Increment missed pongs on connection error (treat as failed ping)
        missedPongsRef.current++
        setDebugInfo((prev) => ({
          ...prev,
          status: 'error',
          missedPongs: missedPongsRef.current,
        }))

        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectNative()
          }, 3000)
        }
      }

      ws.onclose = () => {
        setStatus('disconnected')
        setDebugInfo((prev) => ({ ...prev, status: 'disconnected' }))

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
          connectNative()
        }, 3000)
      }
    } catch {
      setStatus('error')
      // Increment missed pongs on connection failure (treat as failed ping)
      missedPongsRef.current++
      setDebugInfo((prev) => ({
        ...prev,
        status: 'error',
        missedPongs: missedPongsRef.current,
      }))

      reconnectTimeoutRef.current = setTimeout(() => {
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
      setDebugInfo((prev) => ({ ...prev, status: 'connected', missedPongs: 0 }))
      missedPongsRef.current = 0

      // Invalidate presentation state to refetch current state on reconnection
      queryClient.invalidateQueries({ queryKey: presentationStateQueryKey })

      // Listen for messages and connection events
      ws.addListener((message) => {
        // Handle close event from Tauri WebSocket
        if (message.type === 'Close') {
          logger.debug('Tauri WebSocket closed')
          setStatus('disconnected')
          setDebugInfo((prev) => ({ ...prev, status: 'disconnected' }))
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
        setStatus('disconnected')
        setDebugInfo((prev) => ({ ...prev, status: 'disconnected' }))

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
      setStatus('error')
      // Increment missed pongs on connection failure (treat as failed ping)
      missedPongsRef.current++
      setDebugInfo((prev) => ({
        ...prev,
        status: 'error',
        missedPongs: missedPongsRef.current,
      }))

      // Retry connection
      reconnectTimeoutRef.current = setTimeout(() => {
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

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return { status, connect, disconnect, send, debugInfo }
}
