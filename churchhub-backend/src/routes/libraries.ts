import { type Context, Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { authorizeLibraryWrite } from '../library/authorizeLibraryWrite'
import { checkManifest } from '../library/checkManifest'
import { createSubmission } from '../library/createSubmission'
import { decideSubmission } from '../library/decideSubmission'
import { deleteLibrary } from '../library/deleteLibrary'
import { isCurator } from '../library/isCurator'
import { isSourceId } from '../library/isSourceId'
import { libraryKeys } from '../library/libraryKeys'
import { listSubmissions } from '../library/listSubmissions'
import { parseDecision } from '../library/parseDecision'
import { parseFeatured } from '../library/parseFeatured'
import { parseSubmission } from '../library/parseSubmission'
import { publishManifest } from '../library/publishManifest'
import { putShard } from '../library/putShard'
import { requireCurator } from '../library/requireCurator'
import { requireManagedWriter } from '../library/requireManagedWriter'
import { CURATED_SOURCE_ID } from '../library/types'
import { writeFeatured } from '../library/writeFeatured'
import { handleSyncError } from '../sync/handleSyncError'
import { ticketFromHeader, verifyOwnerTicket } from '../sync/owner/ownerTicket'
import { readJsonBody } from '../sync/readJsonBody'
import { createSyncStore } from '../sync/state/createSyncStore'
import { SyncError } from '../sync/SyncError'
import type { Bindings } from '../types'
import { clientIp } from '../utils/clientIp'

type LibraryContext = Context<{ Bindings: Bindings }>

/** Up to MAX_SONGS songs' OpenSong files (a few KB each, 200 KB at most). */
const SUBMISSION_MAX_BYTES = 16 * 1024 * 1024
/** A gzipped shard: up to about 500 songs. */
const SHARD_MAX_BYTES = 4 * 1024 * 1024
/** A whole manifest: about 250 bytes a song. */
const MANIFEST_MAX_BYTES = 32 * 1024 * 1024

const CURATED = `/sync/libraries/${CURATED_SOURCE_ID}`

function limit(maxSize: number) {
  return bodyLimit({
    maxSize,
    onError: (c) =>
      c.json({ error: 'Request is too large', code: 'too_large' }, 413),
  })
}

/** The library in the path; 400 when it can't be one. */
function sourceIdOf(c: LibraryContext): string {
  const sourceId = c.req.param('sourceId') ?? ''
  if (!isSourceId(sourceId)) {
    throw new SyncError(400, 'invalid_request', 'Invalid library id')
  }
  return sourceId
}

/**
 * Shared song libraries (design §9): a PC builds a library's shards and
 * manifest (song-formats' library format) and publishes them here, the
 * only writer, which checks them and who may write (authorizeLibraryWrite).
 * Readers GET them straight from the bucket. The curated Church Hub
 * Library (T-177) adds submissions: any church sends a song; curators
 * (LIBRARY_CURATORS, signed in with Google, `cho_…` ticket) approve it,
 * merge it into an existing song or reject it.
 */
const libraries = new Hono<{ Bindings: Bindings }>()

libraries.onError(handleSyncError)

/** POST /sync/libraries/church-hub/submissions: a church sends songs. */
libraries.post(
  `${CURATED}/submissions`,
  limit(SUBMISSION_MAX_BYTES),
  async (c) => {
    if (c.env.LIBRARY_RATE_LIMITER) {
      const { success } = await c.env.LIBRARY_RATE_LIMITER.limit({
        key: `library-submission:${clientIp(c)}`,
      })
      if (!success) {
        throw new SyncError(429, 'rate_limited', 'Too many submissions')
      }
    }
    const input = parseSubmission(await readJsonBody(c))
    const { states } = createSyncStore(c.env)
    const { batchId, submissions } = await createSubmission(states, input)
    return c.json({ batchId, submitted: submissions.length }, 201)
  }
)

/** GET /sync/libraries/church-hub/curator: is the signed-in account one? */
libraries.get(`${CURATED}/curator`, async (c) => {
  const store = createSyncStore(c.env)
  const account = await verifyOwnerTicket(
    ticketFromHeader(c.req.header('Authorization')),
    store.secret
  )
  return c.json({
    email: account.email,
    curator: isCurator(c.env.LIBRARY_CURATORS, account),
  })
})

/** GET /sync/libraries/church-hub/submissions: the queue, for curators. */
libraries.get(`${CURATED}/submissions`, async (c) => {
  const store = createSyncStore(c.env)
  await requireCurator(c, store)
  return c.json({ submissions: await listSubmissions(store.states) })
})

/** POST /sync/libraries/church-hub/submissions/:id/decision: record it. */
libraries.post(`${CURATED}/submissions/:id/decision`, async (c) => {
  const input = parseDecision(await readJsonBody(c))
  const store = createSyncStore(c.env)
  const account = await requireCurator(c, store)
  const decided = await decideSubmission(
    store,
    c.req.param('id'),
    input,
    account.email
  )
  return c.json({
    id: decided.id,
    decision: decided.decision,
    librarySongId: decided.librarySongId,
  })
})

/** GET /sync/libraries: where the public catalog of listed libraries is read from. */
libraries.get('/sync/libraries', (c) => {
  const { bucket } = createSyncStore(c.env)
  return c.json({
    catalogUrl: bucket.publicUrl(libraryKeys.catalog),
    featuredUrl: bucket.publicUrl(libraryKeys.featured),
  })
})

/** PUT /sync/featured-sources: the sources every app lists (curators, the build). */
libraries.put('/sync/featured-sources', async (c) => {
  const sources = parseFeatured(await readJsonBody(c))
  const store = createSyncStore(c.env)
  await requireManagedWriter(c, store)
  return c.json(await writeFeatured(store.bucket, sources))
})

/** GET /sync/libraries/:sourceId: where the library is read from. */
libraries.get('/sync/libraries/:sourceId', (c) => {
  const { bucket } = createSyncStore(c.env)
  return c.json({
    manifestUrl: bucket.publicUrl(libraryKeys.manifest(sourceIdOf(c))),
  })
})

/** PUT /sync/libraries/:sourceId/shards/:hash: a shard's gzipped JSON. */
libraries.put(
  '/sync/libraries/:sourceId/shards/:hash',
  limit(SHARD_MAX_BYTES),
  async (c) => {
    const sourceId = sourceIdOf(c)
    const store = createSyncStore(c.env)
    await authorizeLibraryWrite(c, store, sourceId)
    const body = new Uint8Array(await c.req.arrayBuffer())
    await putShard(store.bucket, sourceId, c.req.param('hash'), body)
    return c.json({ stored: true })
  }
)

/** PUT /sync/libraries/:sourceId/manifest: { baseChecksum, manifest }. */
libraries.put(
  '/sync/libraries/:sourceId/manifest',
  limit(MANIFEST_MAX_BYTES),
  async (c) => {
    const sourceId = sourceIdOf(c)
    const body = (await readJsonBody(c)) as {
      baseChecksum?: unknown
      manifest?: unknown
    }
    const manifest = checkManifest(body?.manifest, sourceId)
    if (body.baseChecksum !== null && typeof body.baseChecksum !== 'string') {
      throw new SyncError(
        400,
        'invalid_request',
        'baseChecksum is required (null for the first publish)'
      )
    }
    const store = createSyncStore(c.env)
    await authorizeLibraryWrite(c, store, sourceId)
    await publishManifest(store.bucket, manifest, body.baseChecksum)
    return c.json({ checksum: manifest.checksum })
  }
)

/** DELETE /sync/libraries/:sourceId: stop sharing it (its publisher only). */
libraries.delete('/sync/libraries/:sourceId', async (c) => {
  const sourceId = sourceIdOf(c)
  const store = createSyncStore(c.env)
  await authorizeLibraryWrite(c, store, sourceId)
  await deleteLibrary(store.bucket, sourceId)
  return c.json({ deleted: true })
})

export default libraries
