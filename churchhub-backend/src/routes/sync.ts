import { type Context, Hono } from 'hono'
import { addDevice } from '../sync/addDevice'
import { authenticate } from '../sync/authenticate'
import { checkInstallation } from '../sync/checkInstallation'
import { churchPrefix } from '../sync/churchPrefix'
import { commitChanges } from '../sync/commitChanges'
import { compact } from '../sync/compact'
import { parseMediaItems } from '../sync/media/parseMediaItems'
import { publishMedia } from '../sync/media/publishMedia'
import { handleSyncError } from '../sync/handleSyncError'
import { listDevices } from '../sync/listDevices'
import { claimChurch } from '../sync/owner/claimChurch'
import { verifyOwnerTicket } from '../sync/owner/ownerTicket'
import { syncOpenApi } from '../sync/openapi'
import { parseChanges } from '../sync/parseChanges'
import { readInstallation } from '../sync/readInstallation'
import { readJsonBody } from '../sync/readJsonBody'
import { registerChurch } from '../sync/registerChurch'
import { requirePermission } from '../sync/requirePermission'
import { revokeDevice } from '../sync/revokeDevice'
import { rotatePath } from '../sync/rotatePath'
import type { ChurchState, SyncStore } from '../sync/state/ChurchState'
import { createSyncStore } from '../sync/state/createSyncStore'
import { readChurch } from '../sync/state/readChurch'
import { SyncError } from '../sync/SyncError'
import { syncBodyLimit } from '../sync/syncBodyLimit'
import type { Bindings } from '../types'
import { clientIp } from '../utils/clientIp'

const DEFAULT_COMPACT_AFTER = 40
const DEFAULT_MEDIA_MAX_BYTES = 2 * 1024 ** 3
const DEFAULT_MEDIA_MAX_FILE_BYTES = 512 * 1024 ** 2
/** Pinned, so the docs page runs only the Scalar build it was checked with. */
const SCALAR_VERSION = '1.76.4'
/** Managing devices and access needs the app's user management permission. */
const MANAGE_PERMISSION = 'users.edit'

type SyncContext = Context<{ Bindings: Bindings }>

const sync = new Hono<{ Bindings: Bindings }>()

sync.onError(handleSyncError)
// Every /sync route, the owner's (/sync/owner/*) included.
sync.use('/sync/*', syncBodyLimit)

/**
 * The church in the path, read once, and the device calling for it. The
 * church server's calls are checked against the installation holding its
 * token (checkInstallation); `takeover` makes the caller's the one.
 */
async function caller(c: SyncContext, store: SyncStore, takeover = false) {
  const found = await readChurch(store, c.req.param('churchId') ?? '')
  const who = await authenticate(store, found, c.req.header('Authorization'))
  // authenticate refuses an unknown church, so it was found.
  const church = await checkInstallation(
    store,
    found as NonNullable<typeof found>,
    who,
    readInstallation((name) => c.req.header(name)),
    takeover
  )
  return { who, church }
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
      `<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_VERSION}"></script>` +
      '</body></html>'
  )
)

/** POST /sync/churches: register a church server, owned or as a guest. */
sync.post('/sync/churches', async (c) => {
  if (c.env.SYNC_RATE_LIMITER) {
    const ip = clientIp(c)
    const { success } = await c.env.SYNC_RATE_LIMITER.limit({
      key: `sync-register:${ip}`,
    })
    if (!success) throw new SyncError(429, 'rate_limited', 'Too many requests')
  }
  const body = (await readJsonBody(c)) as { name?: unknown; ownerTicket?: unknown }
  const name =
    typeof body?.name === 'string' && body.name.trim()
      ? body.name.trim().slice(0, 200)
      : 'Church server'
  const store = createSyncStore(c.env)
  const owner =
    body?.ownerTicket === undefined || body.ownerTicket === null
      ? null
      : await verifyOwnerTicket(String(body.ownerTicket), store.secret)
  const installation = readInstallation((header) => c.req.header(header))
  return c.json(await registerChurch(store, name, owner, installation), 201)
})

/** POST /sync/churches/:churchId/owner: a guest church claimed by its owner. */
sync.post('/sync/churches/:churchId/owner', async (c) => {
  const body = (await readJsonBody(c)) as { ownerTicket?: unknown }
  const store = createSyncStore(c.env)
  const owner = await verifyOwnerTicket(
    typeof body?.ownerTicket === 'string' ? body.ownerTicket : null,
    store.secret
  )
  const { who } = await caller(c, store)
  if (!who.isServer) {
    throw new SyncError(403, 'forbidden', 'Only the church server can claim it')
  }
  return c.json(await claimChurch(store, who.churchId, owner))
})

/**
 * POST /sync/churches/:churchId/takeover: this PC keeps the church server
 * (the user chose it after a 409 server_in_use); the other PC is refused.
 */
sync.post('/sync/churches/:churchId/takeover', async (c) => {
  const store = createSyncStore(c.env)
  const { who, church } = await caller(c, store, true)
  if (!who.isServer) {
    throw new SyncError(403, 'forbidden', 'Only the church server can')
  }
  return c.json(readLocation(store, church.state))
})

/**
 * GET /sync/churches/:churchId/path: where to read, after a rotation, and
 * who owns the church. The church PC checks in with it now and then.
 */
sync.get('/sync/churches/:churchId/path', async (c) => {
  const store = createSyncStore(c.env)
  const { church } = await caller(c, store)
  return c.json({
    ...readLocation(store, church.state),
    ownerEmail: church.state.owner?.email ?? null,
  })
})

/**
 * GET /sync/churches/:churchId/device: the device behind the token, and its
 * user. The church PC asks it with a phone's token before it lets the phone
 * in over WebRTC (T-174): a revoked token is refused here first.
 */
sync.get('/sync/churches/:churchId/device', async (c) => {
  const store = createSyncStore(c.env)
  const { who } = await caller(c, store)
  return c.json({ deviceId: who.deviceId, userId: who.userId, isServer: who.isServer })
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
  const body = (await readJsonBody(c)) as { userId?: unknown; name?: unknown }
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

/**
 * POST /sync/churches/:churchId/media: the media the church's synced data
 * references, from its PC (the only device holding the files). Lists what
 * is in the bucket for readers and hands out uploads for the rest.
 */
sync.post('/sync/churches/:churchId/media', async (c) => {
  const items = parseMediaItems(await readJsonBody(c))
  const store = createSyncStore(c.env)
  const { who, church } = await caller(c, store)
  if (!who.isServer) {
    throw new SyncError(403, 'forbidden', 'Only the church server publishes media')
  }
  return c.json(
    await publishMedia(store, church.state, items, {
      maxBytes: Number(c.env.SYNC_MEDIA_MAX_BYTES) || DEFAULT_MEDIA_MAX_BYTES,
      maxFileBytes:
        Number(c.env.SYNC_MEDIA_MAX_FILE_BYTES) || DEFAULT_MEDIA_MAX_FILE_BYTES,
    })
  )
})

/** POST /sync/churches/:churchId/changes: one checked, versioned write. */
sync.post('/sync/churches/:churchId/changes', async (c) => {
  const changes = parseChanges(await readJsonBody(c))
  const store = createSyncStore(c.env)
  const { who, church } = await caller(c, store)
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
