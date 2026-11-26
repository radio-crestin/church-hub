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
import adminApp from '../admin/adminApp'
import app from '../index'
import { runBackupMaintenance } from '../backup/runBackupMaintenance'
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
  console.warn('[server] REDIS_URL is not set: signaling and rate limits live in memory (one replica only)')
}
const bindingsFor = createSyncGuard(buildNodeBindings(settings, redis))
const isTrustedProxy = createCidrMatcher(settings.TRUSTED_PROXY_CIDRS ?? '')
const port = Number(settings.PORT ?? 8787)
const hostname = settings.HOST ?? '0.0.0.0'

type NodeEnv = { incoming: { socket: { remoteAddress?: string } } }

/** Each request with its resolved client address, for one Hono app. */
const serveApp =
  (target: { fetch: typeof app.fetch }) => (request: Request, nodeEnv: NodeEnv) => {
    const clientIp = resolveClientIp({
      peer: nodeEnv.incoming.socket.remoteAddress ?? 'unknown',
      forwardedFor: request.headers.get('X-Forwarded-For'),
      isTrustedProxy,
    })
    return target.fetch(withClientIp(request, clientIp), bindingsFor())
  }

const server = serve({ port, hostname, fetch: serveApp(app) })
console.log(`[server] Church Hub backend listening on http://${hostname}:${port}`)

// The internal admin panel (src/admin): only on its own listener, which the
// cluster exposes internally; the public app above has no /admin routes.
const adminPort = settings.ADMIN_PORT ? Number(settings.ADMIN_PORT) : null
if (adminPort === port) throw new Error('ADMIN_PORT must differ from PORT')
const adminServer = adminPort
  ? serve({
      port: adminPort,
      hostname: settings.ADMIN_HOST ?? '127.0.0.1',
      fetch: serveApp(adminApp),
    })
  : null
if (adminServer) {
  console.log(`[server] admin panel listening on port ${adminPort}`)
}

// Cloud backup upkeep, as Cloudflare's cron triggers do on the Worker.
const HOUR_MS = 60 * 60 * 1000
const maintenance = [
  setInterval(() => void runBackupMaintenance(bindingsFor(), { reconcile: false }), HOUR_MS),
  setInterval(() => void runBackupMaintenance(bindingsFor(), { reconcile: true }), 24 * HOUR_MS),
]
for (const timer of maintenance) timer.unref()

function shutdown(): void {
  console.log('[server] shutting down')
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref()
  adminServer?.close()
  server.close(() => {
    const quit = redis?.isOpen ? redis.quit() : Promise.resolve()
    quit.finally(() => process.exit(0))
  })
}
process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
