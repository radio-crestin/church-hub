import { createClient } from 'redis'
import type { RedisCommands } from './types'

/**
 * A Redis client for REDIS_URL that connects in the background and keeps
 * reconnecting; commands wait in its queue meanwhile. Errors are logged,
 * never fatal, so the server (and /health) stays up while Redis is away.
 */
export function connectRedis(url: string) {
  const client = createClient({ url })
  client.on('error', (error: Error) =>
    console.error('[redis] connection error:', error.message)
  )
  client.connect().catch((error: Error) =>
    console.error('[redis] first connection failed:', error.message)
  )
  return client as typeof client & RedisCommands
}
