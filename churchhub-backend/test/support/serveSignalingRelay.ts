/**
 * The relay's whole app (signaling routes, CORS, security headers, body
 * limits) on Bun with an in-memory KV, for the desktop app's e2e suite:
 *
 *   PORT=8788 ALLOWED_ORIGINS=http://localhost:3099 bun test/support/serveSignalingRelay.ts
 */
import app from '../../src/index'
import { memoryKv } from './memoryKv'

const port = Number(process.env.PORT ?? 8788)
const hostname = '127.0.0.1'
const env = {
  SIGNALING_KV: memoryKv(),
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? '',
}

Bun.serve({ port, hostname, fetch: (request) => app.fetch(request, env) })
console.log(`[signal] relay listening on http://${hostname}:${port}`)
