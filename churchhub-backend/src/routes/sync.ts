import { eq } from 'drizzle-orm'
import { type Context, Hono } from 'hono'
import { addDevice } from '../sync/addDevice'
import { authenticate } from '../sync/authenticate'
import { churchPrefix } from '../sync/churchPrefix'
import { commitChanges } from '../sync/commitChanges'
import { compact } from '../sync/compact'
import { createBucket } from '../sync/createBucket'
import { getSyncDb } from '../sync/db/getSyncDb'
import type { SyncDb } from '../sync/db/SyncDb'
import { syncOpenApi } from '../sync/openapi'
import { parseAccess } from '../sync/parseAccess'
import { parseChanges } from '../sync/parseChanges'
import { registerChurch } from '../sync/registerChurch'
import { requirePermission } from '../sync/requirePermission'
import { revokeDevice } from '../sync/revokeDevice'
import { rotatePath } from '../sync/rotatePath'
import { SyncError } from '../sync/SyncError'
import { updateAccess } from '../sync/updateAccess'
import type { Bindings } from '../types'

/** A first sync sends its library in chunks well under this. */
const BODY_MAX_BYTES = 8 * 1024 * 1024
const DEFAULT_COMPACT_AFTER = 40
/** Managing devices and access needs the app's user management permission. */
const MANAGE_PERMISSION = 'users.edit'

type SyncEnv = { Bindings: Bindings; Variables: { syncDb?: SyncDb } }
type SyncContext = Context<SyncEnv>

const sync = new Hono<SyncEnv>()

/** A database opened for one request is closed once it is answered. */
sync.use('/sync/*', async (c, next) => {
  await next()
  const db = c.get('syncDb')
  if (db) c.executionCtx.waitUntil(db.close())
})

/** Every error a /sync route raises, as `{ error, code, ...details }`. */
sync.onError((error, c) => {
  if (error instanceof SyncError) {
    return c.json(
      { error: error.message, code: error.code, ...error.details },
      error.status
    )
  }
  console.error('[sync] request failed:', error)
  return c.json({ error: 'Internal server error', code: 'internal' }, 500)
})

async function readJson(c: SyncContext): Promise<unknown> {
  if (Number(c.req.header('Content-Length') ?? 0) > BODY_MAX_BYTES) {
    throw new SyncError(413, 'too_large', 'Request is too large')
  }
  return c.req.json().catch(() => {
    throw new SyncError(400, 'invalid_request', 'Body must be JSON')
  })
}

/**
 * This request's database: self-hosted, the one server.ts opened; on
 * Workers, opened on first use and closed after the response.
 */
function database(c: SyncContext): SyncDb {
  if (c.env.SYNC_DATABASE) return c.env.SYNC_DATABASE
  let db = c.get('syncDb')
  if (!db) {
    db = getSyncDb(c.env)
    c.set('syncDb', db)
  }
  return db
}

function context(c: SyncContext) {
  return { db: database(c), bucket: createBucket(c.env) }
}

async function caller(c: SyncContext, actingUserId?: string | null) {
  return authenticate(
    database(c),
    c.env.SYNC_TOKEN_SECRET,
    c.req.param('churchId') ?? '',
    c.req.header('Authorization'),
    actingUserId
  )
}

/** The church's current read location, after a write or a rotation. */
async function readLocation(c: SyncContext, churchId: string) {
  const { db, bucket } = context(c)
  const { churches } = db.t
  const [church] = await db.q
    .select({ pathSecret: churches.pathSecret })
    .from(churches)
    .where(eq(churches.id, churchId))
  return {
    pathSecret: church.pathSecret,
    readUrl: bucket.publicUrl(churchPrefix(churchId, church.pathSecret)),
  }
}

sync.get('/sync/openapi.json', (c) => c.json(syncOpenApi))

/** GET /sync/docs: the OpenAPI document, rendered by Scalar. */
sync.get('/sync/docs', (c) =>
  c.html(
    '<!doctype html><html><head><title>Church Hub cloud sync</title>' +
      '<meta charset="utf-8"></head><body>' +
      '<script id="api-reference" data-url="/sync/openapi.json"></script>' +
      '<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>' +
      '</body></html>'
  )
)

/** POST /sync/churches: register a church server as a guest. */
sync.post('/sync/churches', async (c) => {
  if (c.env.SYNC_RATE_LIMITER) {
    const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
    const { success } = await c.env.SYNC_RATE_LIMITER.limit({
      key: `sync-register:${ip}`,
    })
    if (!success) throw new SyncError(429, 'rate_limited', 'Too many requests')
  }
  const body = (await readJson(c)) as { name?: unknown }
  const name =
    typeof body?.name === 'string' && body.name.trim()
      ? body.name.trim().slice(0, 200)
      : 'Church server'
  const { db, bucket } = context(c)
  if (!c.env.SYNC_TOKEN_SECRET) {
    throw new SyncError(503, 'not_configured', 'Cloud sync is not configured')
  }
  return c.json(
    await registerChurch(db, bucket, c.env.SYNC_TOKEN_SECRET, name),
    201
  )
})

/** GET /sync/churches/:churchId/path: where to read, after a rotation. */
sync.get('/sync/churches/:churchId/path', async (c) => {
  const who = await caller(c)
  return c.json(await readLocation(c, who.churchId))
})

/** PUT /sync/churches/:churchId/access: the church's roles and users. */
sync.put('/sync/churches/:churchId/access', async (c) => {
  const access = parseAccess(await readJson(c))
  const who = await caller(c)
  const { db } = context(c)
  await requirePermission(db, who, MANAGE_PERMISSION)
  return c.json({ changed: await updateAccess(db, who.churchId, access) })
})

/** POST /sync/churches/:churchId/devices: a token for one of the users. */
sync.post('/sync/churches/:churchId/devices', async (c) => {
  const body = (await readJson(c)) as { userId?: unknown; name?: unknown }
  if (typeof body?.userId !== 'string' || typeof body.name !== 'string') {
    throw new SyncError(400, 'invalid_request', 'userId and name are required')
  }
  const who = await caller(c)
  const { db } = context(c)
  await requirePermission(db, who, MANAGE_PERMISSION)
  const device = await addDevice(
    db,
    c.env.SYNC_TOKEN_SECRET ?? '',
    who.churchId,
    {
      userId: body.userId,
      name: body.name.slice(0, 200),
    }
  )
  return c.json(device, 201)
})

/** DELETE /sync/churches/:churchId/devices/:deviceId: revoke, rotate the path. */
sync.delete('/sync/churches/:churchId/devices/:deviceId', async (c) => {
  const who = await caller(c)
  const { db, bucket } = context(c)
  await requirePermission(db, who, MANAGE_PERMISSION)
  await revokeDevice(db, bucket, who.churchId, c.req.param('deviceId'))
  return c.json({ revoked: true, ...(await readLocation(c, who.churchId)) })
})

/** POST /sync/churches/:churchId/changes: one checked, versioned write. */
sync.post('/sync/churches/:churchId/changes', async (c) => {
  const { changes, actingUserId } = parseChanges(await readJson(c))
  const who = await caller(c, actingUserId)
  const { db, bucket } = context(c)
  const compactAfter = Number(c.env.SYNC_COMPACT_AFTER) || DEFAULT_COMPACT_AFTER
  const result = await commitChanges(db, bucket, who, changes, compactAfter)
  return c.json({ ...result, ...(await readLocation(c, who.churchId)) })
})

/** POST /sync/churches/:churchId/compact: write a snapshot now. */
sync.post('/sync/churches/:churchId/compact', async (c) => {
  const who = await caller(c)
  const { db, bucket } = context(c)
  return c.json({ snapshotSeq: await compact(db, bucket, who.churchId) })
})

/** POST /sync/churches/:churchId/rotate: move to a fresh path secret. */
sync.post('/sync/churches/:churchId/rotate', async (c) => {
  const who = await caller(c)
  const { db, bucket } = context(c)
  await requirePermission(db, who, MANAGE_PERMISSION)
  await rotatePath(db, bucket, who.churchId)
  return c.json(await readLocation(c, who.churchId))
})

export default sync
