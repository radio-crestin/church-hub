import { type Context, Hono } from 'hono'
import { addDevice } from '../sync/addDevice'
import { authenticate } from '../sync/authenticate'
import { churchPrefix } from '../sync/churchPrefix'
import { commitChanges } from '../sync/commitChanges'
import { compact } from '../sync/compact'
import { listDevices } from '../sync/listDevices'
import { syncOpenApi } from '../sync/openapi'
import { parseAccess } from '../sync/parseAccess'
import { parseChanges } from '../sync/parseChanges'
import { registerChurch } from '../sync/registerChurch'
import { requirePermission } from '../sync/requirePermission'
import { revokeDevice } from '../sync/revokeDevice'
import { rotatePath } from '../sync/rotatePath'
import type { ChurchState, SyncStore } from '../sync/state/ChurchState'
import { createSyncStore } from '../sync/state/createSyncStore'
import { readChurch } from '../sync/state/readChurch'
import { SyncError } from '../sync/SyncError'
import { updateAccess } from '../sync/updateAccess'
import type { Bindings } from '../types'

/** A first sync sends its library in chunks well under this. */
const BODY_MAX_BYTES = 8 * 1024 * 1024
const DEFAULT_COMPACT_AFTER = 40
/** Managing devices and access needs the app's user management permission. */
const MANAGE_PERMISSION = 'users.edit'

type SyncContext = Context<{ Bindings: Bindings }>

const sync = new Hono<{ Bindings: Bindings }>()

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

/** The church in the path, read once, and the device calling for it. */
async function caller(
  c: SyncContext,
  store: SyncStore,
  actingUserId?: string | null
) {
  const church = await readChurch(store, c.req.param('churchId') ?? '')
  const who = await authenticate(
    store,
    church,
    c.req.header('Authorization'),
    actingUserId
  )
  // authenticate refuses an unknown church, so it was found.
  return { who, church: church as NonNullable<typeof church> }
}

/** Where the church is read from now, after a write or a rotation. */
function readLocation(store: SyncStore, state: ChurchState) {
  return {
    pathSecret: state.pathSecret,
    readUrl: store.bucket.publicUrl(churchPrefix(state.id, state.pathSecret)),
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
  return c.json(await registerChurch(createSyncStore(c.env), name), 201)
})

/** GET /sync/churches/:churchId/path: where to read, after a rotation. */
sync.get('/sync/churches/:churchId/path', async (c) => {
  const store = createSyncStore(c.env)
  const { church } = await caller(c, store)
  return c.json(readLocation(store, church.state))
})

/** PUT /sync/churches/:churchId/access: the church's roles and users. */
sync.put('/sync/churches/:churchId/access', async (c) => {
  const access = parseAccess(await readJson(c))
  const store = createSyncStore(c.env)
  const { who, church } = await caller(c, store)
  requirePermission(church.state, who, MANAGE_PERMISSION)
  return c.json({ changed: await updateAccess(store, who.churchId, access) })
})

/** GET /sync/churches/:churchId/devices: every device, revoked ones too. */
sync.get('/sync/churches/:churchId/devices', async (c) => {
  const store = createSyncStore(c.env)
  const { who, church } = await caller(c, store)
  requirePermission(church.state, who, MANAGE_PERMISSION)
  return c.json({ devices: listDevices(church.state) })
})

/** POST /sync/churches/:churchId/devices: a token for one of the users. */
sync.post('/sync/churches/:churchId/devices', async (c) => {
  const body = (await readJson(c)) as { userId?: unknown; name?: unknown }
  if (typeof body?.userId !== 'string' || typeof body.name !== 'string') {
    throw new SyncError(400, 'invalid_request', 'userId and name are required')
  }
  const store = createSyncStore(c.env)
  const { who, church } = await caller(c, store)
  requirePermission(church.state, who, MANAGE_PERMISSION)
  const device = await addDevice(store, who.churchId, {
    userId: body.userId,
    name: body.name.slice(0, 200),
  })
  return c.json(device, 201)
})

/** DELETE /sync/churches/:churchId/devices/:deviceId: revoke, rotate the path. */
sync.delete('/sync/churches/:churchId/devices/:deviceId', async (c) => {
  const store = createSyncStore(c.env)
  const { who, church } = await caller(c, store)
  requirePermission(church.state, who, MANAGE_PERMISSION)
  const state = await revokeDevice(store, who.churchId, c.req.param('deviceId'))
  return c.json({ revoked: true, ...readLocation(store, state) })
})

/** POST /sync/churches/:churchId/changes: one checked, versioned write. */
sync.post('/sync/churches/:churchId/changes', async (c) => {
  const { changes, actingUserId } = parseChanges(await readJson(c))
  const store = createSyncStore(c.env)
  const { who, church } = await caller(c, store, actingUserId)
  const compactAfter = Number(c.env.SYNC_COMPACT_AFTER) || DEFAULT_COMPACT_AFTER
  const { state, ...result } = await commitChanges(
    store,
    who,
    changes,
    compactAfter,
    church
  )
  return c.json({ ...result, ...readLocation(store, state) })
})

/** POST /sync/churches/:churchId/compact: write a snapshot now. */
sync.post('/sync/churches/:churchId/compact', async (c) => {
  const store = createSyncStore(c.env)
  const { who } = await caller(c, store)
  const { snapshotSeq } = await compact(store, who.churchId)
  return c.json({ snapshotSeq })
})

/** POST /sync/churches/:churchId/rotate: move to a fresh path secret. */
sync.post('/sync/churches/:churchId/rotate', async (c) => {
  const store = createSyncStore(c.env)
  const { who, church } = await caller(c, store)
  requirePermission(church.state, who, MANAGE_PERMISSION)
  return c.json(readLocation(store, await rotatePath(store, who.churchId)))
})

export default sync
