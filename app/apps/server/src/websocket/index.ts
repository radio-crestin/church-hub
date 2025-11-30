import type { ServerWebSocket } from 'bun'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [websocket] ${message}`)
}

export interface WebSocketData {
  clientId: string
  displayId?: number
}

export type PresentationMessage = {
  type: 'presentation_state'
  payload: {
    programId: number | null
    currentSlideId: number | null
    isPresenting: boolean
    updatedAt: number
  }
}

// Store connected clients
const clients = new Map<string, ServerWebSocket<WebSocketData>>()

/**
 * Generates a unique client ID
 */
function generateClientId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Handles new WebSocket connections
 */
export function handleWebSocketOpen(ws: ServerWebSocket<WebSocketData>) {
  const clientId = ws.data.clientId || generateClientId()
  ws.data.clientId = clientId
  clients.set(clientId, ws)

  log('info', `Client connected: ${clientId} (total: ${clients.size})`)
}

/**
 * Handles WebSocket messages from clients
 */
export function handleWebSocketMessage(
  ws: ServerWebSocket<WebSocketData>,
  message: string | Buffer,
) {
  try {
    const data = JSON.parse(message.toString())
    log('debug', `Message from ${ws.data.clientId}: ${JSON.stringify(data)}`)

    // Handle ping/pong for keepalive
    if (data.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }))
    }
  } catch (error) {
    log('error', `Failed to parse message: ${error}`)
  }
}

/**
 * Handles WebSocket disconnections
 */
export function handleWebSocketClose(ws: ServerWebSocket<WebSocketData>) {
  if (ws.data.clientId) {
    clients.delete(ws.data.clientId)
    log(
      'info',
      `Client disconnected: ${ws.data.clientId} (total: ${clients.size})`,
    )
  }
}

/**
 * Broadcasts presentation state to all connected clients
 */
export function broadcastPresentationState(
  state: PresentationMessage['payload'],
) {
  const message = JSON.stringify({
    type: 'presentation_state',
    payload: state,
  } satisfies PresentationMessage)

  log('debug', `Broadcasting to ${clients.size} clients`)

  for (const [clientId, ws] of clients) {
    try {
      ws.send(message)
    } catch (error) {
      log('error', `Failed to send to ${clientId}: ${error}`)
      clients.delete(clientId)
    }
  }
}

/**
 * Gets the number of connected clients
 */
export function getConnectedClients(): number {
  return clients.size
}
