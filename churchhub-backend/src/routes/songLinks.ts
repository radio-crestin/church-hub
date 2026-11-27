import { type Context, Hono } from 'hono'
import { handleSyncError } from '../sync/handleSyncError'
import { authenticate } from '../sync/authenticate'
import { checkInstallation } from '../sync/checkInstallation'
import { readInstallation } from '../sync/readInstallation'
import { readJsonBody } from '../sync/readJsonBody'
import { requirePermission } from '../sync/requirePermission'
import { createSyncStore } from '../sync/state/createSyncStore'
import type { SyncStore } from '../sync/state/ChurchState'
import { readChurch } from '../sync/state/readChurch'
import { SyncError } from '../sync/SyncError'
import { parseSharedSong } from '../songLinks/parseSharedSong'
import { readSharedSong } from '../songLinks/readSharedSong'
import { shareSong } from '../songLinks/shareSong'
import { unshareSong } from '../songLinks/unshareSong'
import type { Bindings } from '../types'

type SongLinkContext = Context<{ Bindings: Bindings }>

/** Anyone who may see the church's songs may share one. */
const SHARE_SONG_PERMISSION = 'songs.view'
const SONG_UUID = /^[0-9A-Za-z-]{1,64}$/

const songLinks = new Hono<{ Bindings: Bindings }>()
songLinks.onError(handleSyncError)

/** The church, checked: its device's token and the right to see its songs. */
async function sharingChurch(c: SongLinkContext, store: SyncStore) {
  const found = await readChurch(store, c.req.param('churchId') ?? '')
  const who = await authenticate(store, found, c.req.header('Authorization'))
  const church = await checkInstallation(
    store,
    found as NonNullable<typeof found>,
    who,
    readInstallation((name) => c.req.header(name)),
    false
  )
  requirePermission(church.state, who, SHARE_SONG_PERMISSION)
  const songUuid = c.req.param('songUuid') ?? ''
  if (!SONG_UUID.test(songUuid)) {
    throw new SyncError(400, 'invalid_request', 'Invalid song id')
  }
  return { churchId: church.state.id, songUuid }
}

/** PUT /sync/churches/:churchId/song-links/:songUuid: share (or update) a song's page. */
songLinks.put('/sync/churches/:churchId/song-links/:songUuid', async (c) => {
  const store = createSyncStore(c.env)
  const { churchId, songUuid } = await sharingChurch(c, store)
  const song = parseSharedSong(await readJsonBody(c))
  return c.json({ linkId: await shareSong(store, churchId, songUuid, song) })
})

/** DELETE /sync/churches/:churchId/song-links/:songUuid: stop sharing it. */
songLinks.delete('/sync/churches/:churchId/song-links/:songUuid', async (c) => {
  const store = createSyncStore(c.env)
  const { churchId, songUuid } = await sharingChurch(c, store)
  await unshareSong(store, churchId, songUuid)
  return c.body(null, 204)
})

/** GET /sync/song-links/:linkId: the shared song, for its public page. */
songLinks.get('/sync/song-links/:linkId', async (c) => {
  const song = await readSharedSong(createSyncStore(c.env), c.req.param('linkId'))
  c.header('Cache-Control', 'public, max-age=60')
  return c.json(song)
})

export default songLinks
