/**
 * The cloud sync service, self-hosted on Bun or Node with any S3-compatible
 * bucket that supports conditional writes (MinIO, AWS S3, R2…); there is no
 * database: each church's state is an encrypted object in the bucket.
 *
 *   bun src/selfhost/server.ts          (Bun)
 *   npx tsx src/selfhost/server.ts      (Node)
 *
 * Settings come from the environment: SYNC_SECRET, S3_ENDPOINT, S3_BUCKET,
 * S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_URL,
 * S3_STATE_BUCKET (optional), SYNC_COMPACT_AFTER, ALLOWED_ORIGINS, PORT
 * (default 8787) and HOST (default 127.0.0.1). Cloud backup (/backup) takes
 * BACKUP_SECRET, BACKUP_KEY_SECRET and the BACKUP_S3_* settings.
 */
import { Hono } from 'hono'
import {
  createCorsMiddleware,
  createSecurityMiddleware,
} from '../middleware/security'
import backup from '../routes/backup'
import sync from '../routes/sync'
import syncOwner from '../routes/syncOwner'
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

const env = settings as unknown as Bindings

const app = new Hono<{ Bindings: Bindings }>()
for (const middleware of createSecurityMiddleware()) app.use('*', middleware)
app.use('*', createCorsMiddleware())
app.route('/', sync)
app.route('/', syncOwner)
app.route('/', backup)
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
  `[sync] Church Hub cloud sync listening on http://${hostname}:${port}`
)
