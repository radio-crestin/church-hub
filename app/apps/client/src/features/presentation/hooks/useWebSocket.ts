/**
 * Re-export from WebSocketContext for backward compatibility.
 * The WebSocket connection is now managed at the root level by WebSocketProvider.
 */
export {
  useWebSocketContext as useWebSocket,
  type WebSocketDebugInfo,
} from '../context/WebSocketContext'
