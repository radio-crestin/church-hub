import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { getApiUrl, getWsUrl, isMobile } from '~/config'
import { getStoredUserToken } from '~/service/api-url'
import { presentationStateQueryKey } from './usePresentationState'
import { screenQueryKey } from './useScreen'
import type { PresentationState } from '../types'

const DEBUG = import.meta.env.DEV

function log(level: 'debug' | 'info' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [websocket] ${message}`)
}

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

export function useWebSocket() {
  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [status, setStatus] = useState<WebSocketStatus>('disconnected')

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    // Get WebSocket URL - use getWsUrl for mobile support
    let wsUrl = getWsUrl()
    if (!wsUrl) {
      // Fallback to API URL conversion
      const apiUrl = getApiUrl()
      if (!apiUrl) {
        log('error', 'No API URL configured')
        setStatus('error')
        return
      }
      wsUrl = apiUrl.replace(/^http/, 'ws')
    }
    wsUrl = wsUrl + '/ws'

    // Add auth token as query parameter for mobile (WebSocket doesn't support Cookie headers)
    if (isMobile()) {
      const token = getStoredUserToken()
      if (token) {
        wsUrl = `${wsUrl}?token=${encodeURIComponent(token)}`
      }
    }

    log('debug', `Connecting to ${wsUrl}`)
    setStatus('connecting')

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        log('info', 'WebSocket connected')
        setStatus('connected')

        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 30000)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as
            | PresentationMessage
            | ScreenConfigUpdatedMessage
            | ScreenConfigPreviewMessage
            | HighlightColorsUpdatedMessage
            | { type: 'pong' }

          if (data.type === 'pong') {
            log('debug', 'Received pong')
            return
          }

          if (data.type === 'presentation_state') {
            log('debug', 'Received presentation state update')
            // Update React Query cache with new state
            queryClient.setQueryData(presentationStateQueryKey, data.payload)
          }

          if (data.type === 'screen_config_updated') {
            log(
              'debug',
              `Received screen config update for screen ${data.payload.screenId}`,
            )
            // Invalidate the screen query to trigger a refetch
            queryClient.invalidateQueries({
              queryKey: screenQueryKey(data.payload.screenId),
            })
          }

          if (data.type === 'screen_config_preview') {
            log(
              'debug',
              `Received screen config preview for screen ${data.payload.screenId}`,
            )
            // Update React Query cache directly with preview config
            queryClient.setQueryData(
              screenQueryKey(data.payload.screenId),
              data.payload.config,
            )
          }
        } catch (error) {
          log('error', `Failed to parse message: ${error}`)
        }
      }

      ws.onerror = (error) => {
        log('error', `WebSocket error: ${error}`)
        setStatus('error')

        // Schedule reconnection in case onclose doesn't fire
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            log('debug', 'Attempting reconnect after error...')
            connect()
          }, 3000)
        }
      }

      ws.onclose = () => {
        log('info', 'WebSocket disconnected')
        setStatus('disconnected')

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }

        // Clear any existing reconnect timeout (from error handler)
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }

        // Reconnect after delay
        reconnectTimeoutRef.current = setTimeout(() => {
          log('debug', 'Attempting reconnect...')
          connect()
        }, 3000)
      }
    } catch (error) {
      log('error', `Failed to connect: ${error}`)
      setStatus('error')

      // Retry connection
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

  const send = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
      return true
    }
    log('error', 'Cannot send message: WebSocket not connected')
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
