import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  QueueUpdateMessage,
  SessionUpdateMessage,
  SlideChangeMessage,
  WSMessage,
} from '../service/types'

type ClientRole = 'display' | 'controller' | 'viewer'

interface UsePresentationSocketOptions {
  role?: ClientRole
  displayId?: number
  onSlideChange?: (payload: SlideChangeMessage['payload']) => void
  onQueueUpdate?: (payload: QueueUpdateMessage['payload']) => void
  onSessionUpdate?: (payload: SessionUpdateMessage['payload']) => void
  enabled?: boolean
}

interface PresentationSocketState {
  isConnected: boolean
  error: string | null
}

export function usePresentationSocket({
  role = 'viewer',
  displayId,
  onSlideChange,
  onQueueUpdate,
  onSessionUpdate,
  enabled = true,
}: UsePresentationSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [state, setState] = useState<PresentationSocketState>({
    isConnected: false,
    error: null,
  })

  const connect = useCallback(() => {
    if (!enabled) return

    const PORT =
      window.__serverConfig?.serverPort ??
      import.meta.env.VITE_SERVER_PORT ??
      3000
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`)

    ws.onopen = () => {
      setState({ isConnected: true, error: null })

      // Subscribe with role and displayId
      ws.send(
        JSON.stringify({
          type: 'subscribe',
          timestamp: Date.now(),
          payload: {
            role,
            displayId,
          },
        }),
      )

      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
        }
      }, 30000)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WSMessage

        switch (message.type) {
          case 'slide_change':
            onSlideChange?.((message as SlideChangeMessage).payload)
            break
          case 'queue_update':
            onQueueUpdate?.((message as QueueUpdateMessage).payload)
            break
          case 'session_update':
            onSessionUpdate?.((message as SessionUpdateMessage).payload)
            break
          case 'subscribed':
            break
          case 'error':
            break
        }
      } catch (_error) {}
    }

    ws.onerror = (error) => {
      setState((prev) => ({ ...prev, error: 'Connection error' }))
    }

    ws.onclose = () => {
      setState((prev) => ({ ...prev, isConnected: false }))

      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = null
      }

      // Attempt to reconnect after 3 seconds
      if (enabled) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, 3000)
      }
    }

    wsRef.current = ws
  }, [enabled, role, displayId, onSlideChange, onQueueUpdate, onSessionUpdate])

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
    if (enabled) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [enabled, connect, disconnect])

  return {
    isConnected: state.isConnected,
    error: state.error,
    disconnect,
    reconnect: connect,
  }
}
