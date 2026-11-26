/**
 * churchhub-backend on Node (or Bun): the same Hono app as the Worker, with
 * Redis (or memory, outside production) in place of Cloudflare's KV and rate
 * limiters, and the S3 bucket for screenshots. Settings come from the
 * environment (README, "Self-hosted (Node)").
 *
 *   node dist/server.mjs        (the container; built by the Dockerfile)
 *   bun src/node/server.ts      (development, the e2e specs)
 */
import { serve } from '@hono/node-server'
import app from '../index'
import { buildNodeBindings } from './buildNodeBindings'
import { connectRedis } from './connectRedis'
import { createCidrMatcher } from './createCidrMatcher'
import { assertProductionSettings } from './assertProductionSettings'
import { createSyncGuard } from './createSyncGuard'
import { resolveClientIp } from './resolveClientIp'
import { withClientIp } from './withClientIp'

const SHUTDOWN_TIMEOUT_MS = 10_000

const settings = process.env
assertProductionSettings(settings)
const redis = settings.REDIS_URL ? connectRedis(settings.REDIS_URL) : null
if (!redis) {
  console.warn('[server] REDIS_URL is not set: signaling and rate limits live in memory (one process only)')
}
const bindingsFor = createSyncGuard(buildNodeBindings(settings, redis))
const isTrustedProxy = createCidrMatcher(settings.TRUSTED_PROXY_CIDRS ?? '')
const port = Number(settings.PORT ?? 8787)
const hostname = settings.HOST ?? '0.0.0.0'

const server = serve({
  port,
  hostname,
  fetch: (request, nodeEnv: { incoming: { socket: { remoteAddress?: string } } }) => {
    const clientIp = resolveClientIp({
      peer: nodeEnv.incoming.socket.remoteAddress ?? 'unknown',
      forwardedFor: request.headers.get('X-Forwarded-For'),
      isTrustedProxy,
    })
    return app.fetch(withClientIp(request, clientIp), bindingsFor())
  },
})
console.log(`[server] Church Hub backend listening on http://${hostname}:${port}`)

function shutdown(): void {
  console.log('[server] shutting down')
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref()
  server.close(() => {
    const quit = redis?.isOpen ? redis.quit() : Promise.resolve()
    quit.finally(() => process.exit(0))
  })
}
process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
