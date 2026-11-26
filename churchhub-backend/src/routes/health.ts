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

/**
 * GET /health/ready
 * Readiness: 503 while the Node runtime's startup sync probe is still
 * pending, so no traffic reaches a pod before /sync works; 200 once it has
 * settled. A failed probe still reads as ready (sync: disabled) so a bad
 * bucket doesn't take the pod out of service; /sync answers its own 503.
 */
health.get('/health/ready', (c) => {
  c.header('Cache-Control', 'no-store')
  const readiness = c.env.SYNC_READINESS
  if (readiness === 'starting') return c.json({ status: 'starting' }, 503)
  return c.json(readiness ? { status: 'ready', sync: readiness } : { status: 'ready' })
})

export default health
