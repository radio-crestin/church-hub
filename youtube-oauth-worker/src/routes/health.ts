import { Hono } from 'hono'
import type { Bindings } from '../types'

const health = new Hono<{ Bindings: Bindings }>()

/**
 * GET /health
 * Health check endpoint.
 */
health.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'youtube-oauth-worker',
  })
})

export default health
