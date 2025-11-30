import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { getApiUrl } from '~/config'
import { presentationStateQueryKey } from './usePresentationState'
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

    // Get WebSocket URL from API URL
    const apiUrl = getApiUrl()
    const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws'

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
        } catch (error) {
          log('error', `Failed to parse message: ${error}`)
        }
      }

      ws.onerror = (error) => {
        log('error', `WebSocket error: ${error}`)
        setStatus('error')
      }

      ws.onclose = () => {
        log('info', 'WebSocket disconnected')
        setStatus('disconnected')

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
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

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return { status, connect, disconnect }
}
