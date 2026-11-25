/**
 * The cloud sync service, self-hosted on Bun or Node with any S3-compatible
 * bucket and a PostgreSQL or SQLite database:
 *
 *   bun src/selfhost/server.ts          (Bun)
 *   npx tsx src/selfhost/server.ts      (Node)
 *
 * Settings come from the environment: SYNC_DATABASE_URL (postgres://…,
 * libsql://… or file:…; default file:sync.db) with SYNC_DATABASE_AUTH_TOKEN
 * for Turso and SYNC_DATABASE_POOL_MAX (Postgres, default 10), SYNC_TOKEN_SECRET, S3_ENDPOINT, S3_BUCKET, S3_REGION,
 * S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_URL, SYNC_COMPACT_AFTER,
 * ALLOWED_ORIGINS, PORT (default 8787) and HOST (default 127.0.0.1). The
 * database's migrations are applied on start.
 */
import { Hono } from 'hono'
import { migrateSyncDb } from './migrateSyncDb'
import { openSyncDb } from './openSyncDb'
import {
  createCorsMiddleware,
  createSecurityMiddleware,
} from '../middleware/security'
import sync from '../routes/sync'
import type { Bindings } from '../types'

interface Runtime {
  process: { env: Record<string, string | undefined> }
  Bun?: {
    serve(options: {
      port: number
      hostname: string
      fetch: (request: Request) => Response | Promise<Response>
    }): unknown
  }
}

const NODE_SERVER = '@hono/node-server'
const runtime = globalThis as unknown as Runtime
const settings = runtime.process.env

const db = openSyncDb({
  url: settings.SYNC_DATABASE_URL ?? 'file:sync.db',
  authToken: settings.SYNC_DATABASE_AUTH_TOKEN,
  maxConnections: Number(settings.SYNC_DATABASE_POOL_MAX) || undefined,
})
await migrateSyncDb(db)
const env = { ...settings, SYNC_DATABASE: db } as unknown as Bindings

const app = new Hono<{ Bindings: Bindings }>()
for (const middleware of createSecurityMiddleware()) app.use('*', middleware)
app.use('*', createCorsMiddleware())
app.route('/', sync)
app.notFound((c) => c.json({ error: 'Not found' }, 404))

const port = Number(settings.PORT ?? 8787)
const hostname = settings.HOST ?? '127.0.0.1'
const fetch = (request: Request) => app.fetch(request, env)

if (runtime.Bun) {
  runtime.Bun.serve({ port, hostname, fetch })
} else {
  const { serve } = await import(NODE_SERVER)
  serve({ fetch, port, hostname })
}
console.log(
  `[sync] Church Hub cloud sync (${db.dialect}) listening on http://${hostname}:${port}`
)
