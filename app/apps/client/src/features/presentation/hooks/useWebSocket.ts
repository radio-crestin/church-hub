import { useQueryClient } from '@tanstack/react-query'
import TauriWebSocket from '@tauri-apps/plugin-websocket'
import { useCallback, useEffect, useRef, useState } from 'react'

import { getApiUrl, getWsUrl, isMobile } from '~/config'
import { getStoredUserToken } from '~/service/api-url'
import { presentationStateQueryKey } from './usePresentationState'
import { screenQueryKey } from './useScreen'
import type { PresentationState } from '../types'

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

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

type MessageData =
  | PresentationMessage
  | ScreenConfigUpdatedMessage
  | ScreenConfigPreviewMessage
  | HighlightColorsUpdatedMessage
  | { type: 'pong' }

// Check if we should use Tauri WebSocket plugin (on mobile)
const useTauriWebSocket = isMobile()

export function useWebSocket() {
  const queryClient = useQueryClient()
  // For native WebSocket (desktop/browser)
  const nativeWsRef = useRef<WebSocket | null>(null)
  // For Tauri WebSocket (mobile)
  const tauriWsRef = useRef<TauriWebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [status, setStatus] = useState<WebSocketStatus>('disconnected')
  const isConnectingRef = useRef(false)

  const handleMessage = useCallback(
    (messageData: string) => {
      try {
        const data = JSON.parse(messageData) as MessageData

        if (data.type === 'pong') {
          return
        }

        if (data.type === 'presentation_state') {
          queryClient.setQueryData(presentationStateQueryKey, data.payload)
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
        return
      }
      wsUrl = apiUrl.replace(/^http/, 'ws')
    }
    wsUrl = wsUrl + '/ws'

    setStatus('connecting')

    try {
      const ws = new WebSocket(wsUrl)
      nativeWsRef.current = ws

      ws.onopen = () => {
        setStatus('connected')

        // Start ping interval
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 30000)
      }

      ws.onmessage = (event) => {
        handleMessage(event.data)
      }

      ws.onerror = () => {
        setStatus('error')

        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectNative()
          }, 3000)
        }
      }

      ws.onclose = () => {
        setStatus('disconnected')

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
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

      reconnectTimeoutRef.current = setTimeout(() => {
        connectNative()
      }, 5000)
    }
  }, [handleMessage])

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

    try {
      const ws = await TauriWebSocket.connect(wsUrl)
      tauriWsRef.current = ws
      isConnectingRef.current = false

      setStatus('connected')

      // Listen for messages and connection events
      ws.addListener((message) => {
        // Handle close event from Tauri WebSocket
        if (message.type === 'Close') {
          console.log('[WebSocket] Tauri WebSocket closed')
          setStatus('disconnected')
          tauriWsRef.current = null

          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current)
            pingIntervalRef.current = null
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

      // Start ping interval - also detects disconnection when ping fails
      pingIntervalRef.current = setInterval(async () => {
        if (tauriWsRef.current) {
          try {
            await tauriWsRef.current.send(JSON.stringify({ type: 'ping' }))
          } catch {
            // Ping failed - connection is likely dead
            console.log('[WebSocket] Ping failed, connection lost')
            setStatus('disconnected')

            if (pingIntervalRef.current) {
              clearInterval(pingIntervalRef.current)
              pingIntervalRef.current = null
            }

            try {
              await tauriWsRef.current.disconnect()
            } catch {
              // Ignore disconnect errors
            }
            tauriWsRef.current = null

            // Reconnect after delay
            reconnectTimeoutRef.current = setTimeout(() => {
              connectTauri()
            }, 3000)
          }
        }
      }, 30000)
    } catch {
      isConnectingRef.current = false
      setStatus('error')

      // Retry connection
      reconnectTimeoutRef.current = setTimeout(() => {
        connectTauri()
      }, 3000)
    }
  }, [handleMessage])

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

  return { status, connect, disconnect, send }
}
