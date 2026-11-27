import { sanitizeFilename } from '@church-hub/song-formats'

import { requirePermission } from '../middleware/permissions'
import type { RequestContext } from '../middleware/types'
import {
  buildBundleFiles,
  cancelSongUpdates,
  deleteLinkSource,
  deletePublication,
  deleteShare,
  getPublication,
  getS3Storage,
  getShare,
  getSongUpdatesState,
  type LibraryShareInput,
  listPublications,
  listShares,
  listSongSources,
  publishShare,
  readCatalog,
  readChangedForReview,
  readLackingSongs,
  readSourceArchive,
  readSourceChecksum,
  readSourceSongs,
  recountSourceSongs,
  resolveChangedSongs,
  runSongUpdatesInWorker,
  type S3StorageInput,
  SONG_BUNDLE_EXTENSION,
  saveShare,
  setAutoUpdateSongs,
  syncPendingSongs,
  syncPublication,
  toPublicationView,
  toS3StorageView,
  upsertLinkSource,
  upsertPublication,
  upsertS3Storage,
  zipBundleFiles,
} from '../service/song-sources'
import { getCategoryById } from '../service/songs'
import { getCloudIdentity } from '../service/sync/cloud/cloudIdentityStore'
import type { Permission } from '../service/users'
import { createLogger } from '../utils/logger'

type HandleCors = (req: Request, res: Response) => Response

const logger = createLogger('song-sources')

const SOURCE_SONGS_PATH = /^\/api\/song-sources\/([\w-]+)\/songs$/
const SOURCE_ARCHIVE_PATH = /^\/api\/song-sources\/([\w-]+)\/archive$/
const SOURCE_CHECKSUM_PATH = /^\/api\/song-sources\/([\w-]+)\/checksum$/
const SOURCE_LACKING_PATH = /^\/api\/song-sources\/([\w-]+)\/lacking$/
const SOURCE_CHANGED_PATH = /^\/api\/song-sources\/([\w-]+)\/changed$/
const SOURCE_RECOUNT_PATH = /^\/api\/song-sources\/([\w-]+)\/recount$/
const SOURCE_PATH = /^\/api\/song-sources\/([\w-]+)$/
const PUBLICATION_SYNC_PATH = /^\/api\/song-sources\/publications\/(\d+)\/sync$/
const PUBLICATION_PATH = /^\/api\/song-sources\/publications\/(\d+)$/
const SHARE_SYNC_PATH = /^\/api\/song-sources\/shares\/(\d+)\/sync$/
const SHARE_PATH = /^\/api\/song-sources\/shares\/(\d+)$/

/** What a client may read of a failure: an Error's message, never a raw thrown value. */
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unexpected error'

/** "Pe Drumul Credinței" → "Pe Drumul Credinței.chsongs" (or `.zip`). */
function bundleFileName(categoryName: string, format: string | null): string {
  const extension = format === 'zip' ? '.zip' : SONG_BUNDLE_EXTENSION
  return `${sanitizeFilename(categoryName) || 'songs'}${extension}`
}

/**
 * Song sources: where Song discovery imports from, and the user's own
 * sources published to their S3 bucket.
 *
 * - GET    /api/song-sources                     every source (songs.view)
 * - POST   /api/song-sources                     add a source from a link `{ url }` (songs.create)
 * - DELETE /api/song-sources/:id                 remove a source added from a link (songs.create)
 * - GET    /api/song-sources/:id/songs           a shared folder's OpenSong files (songs.create)
 * - GET    /api/song-sources/:id/archive         a song file source's .chsongs (songs.create)
 * - GET    /api/song-sources/:id/checksum        what changes when the source's songs do (songs.view)
 * - GET    /api/song-sources/:id/lacking         the songs its last check found the library lacks (songs.create)
 * - GET    /api/song-sources/:id/changed         library songs its last check found changed, both versions (songs.create)
 * - POST   /api/song-sources/:id/changed         update or keep some of them `{ songIds, action: 'update'|'keep' }` (songs.create)
 * - POST   /api/song-sources/:id/recount         count its waiting songs again, after an import (songs.create)
 * - GET    /api/song-sources/updates             each source's last check for new songs (songs.view)
 * - POST   /api/song-sources/updates/run         check the sources now `{ force?, sourceIds? }` (songs.create)
 * - POST   /api/song-sources/updates/cancel      stop the running check (songs.create)
 * - POST   /api/song-sources/updates/sync        sync the songs waiting for approval (songs.create)
 * - PUT    /api/song-sources/updates/settings    sync without approval `{ autoUpdate }` (settings.edit)
 * - GET    /api/song-sources/export?categoryId=&format=chsongs|zip  a category as a song bundle (songs.view)
 * - GET    /api/song-sources/storage             the S3 storage, without its secret (settings.view)
 * - PUT    /api/song-sources/storage             save the S3 storage (settings.edit)
 * - GET    /api/song-sources/publications        published categories (settings.view)
 * - POST   /api/song-sources/publications        publish a category `{ categoryId }` (settings.edit)
 * - POST   /api/song-sources/publications/:id/sync   upload its changes now (settings.edit)
 * - DELETE /api/song-sources/publications/:id    stop publishing, delete its files (settings.edit)
 * - GET    /api/song-sources/shares              "Share my songs": the shares, and whether cloud sync is on (settings.view)
 * - POST   /api/song-sources/shares              new share `{ name, publisher?, categoryIds: number[]|null, songIds, listed }`, published (settings.edit)
 * - PUT    /api/song-sources/shares/:id          change what a share shares, and publish it (settings.edit)
 * - POST   /api/song-sources/shares/:id/sync     publish it again now (settings.edit)
 * - DELETE /api/song-sources/shares/:id          stop a share: out of the catalog and the bucket (settings.edit)
 * - GET    /api/song-sources/catalog             the shared libraries listed in the public catalog (songs.view)
 */
export async function handleSongSourceRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
  context: RequestContext | null,
): Promise<Response | null> {
  const { pathname } = url
  if (!pathname.startsWith('/api/song-sources')) return null

  const respond = (status: number, payload: unknown): Response =>
    handleCors(
      req,
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  const deny = (permission: Permission): Response | null => {
    if (!context) return respond(401, { error: 'Unauthorized' })
    const denied = requirePermission(permission)(context)
    return denied ? handleCors(req, denied) : null
  }
  const readJson = async <T>(): Promise<Partial<T>> =>
    ((await req.json().catch(() => null)) ?? {}) as Partial<T>
  const publicationsView = () => {
    const storage = getS3Storage()
    return listPublications().map((p) => toPublicationView(p, storage))
  }
  /** Creates a share (no id) or changes one; it must share something. */
  const saveShareRoute = async (
    input: Partial<LibraryShareInput>,
    id?: number,
  ): Promise<Response> => {
    const ids = (value: unknown) =>
      Array.isArray(value) ? value.filter((v) => Number.isInteger(v)) : []
    const categoryIds = Array.isArray(input.categoryIds)
      ? ids(input.categoryIds)
      : null
    const songIds = categoryIds ? ids(input.songIds) : []
    if (categoryIds?.length === 0 && songIds.length === 0) {
      return respond(400, { error: 'Choose at least one category or song' })
    }
    try {
      const share = await saveShare(
        {
          name: String(input.name ?? ''),
          publisher:
            typeof input.publisher === 'string' ? input.publisher : undefined,
          categoryIds,
          songIds,
          listed: input.listed === true,
        },
        id,
      )
      if (!share) return respond(404, { error: 'Share not found' })
      return respond(id === undefined ? 201 : 200, { data: share })
    } catch (error) {
      return respond(errorMessage(error) === 'cloud_sync_off' ? 409 : 502, {
        error: errorMessage(error),
      })
    }
  }

  if (req.method === 'GET' && pathname === '/api/song-sources') {
    return deny('songs.view') ?? respond(200, { data: listSongSources() })
  }

  if (req.method === 'GET' && pathname === '/api/song-sources/updates') {
    return deny('songs.view') ?? respond(200, { data: getSongUpdatesState() })
  }

  if (req.method === 'POST' && pathname === '/api/song-sources/updates/run') {
    const denied = deny('songs.create')
    if (denied) return denied
    const { force, sourceIds } = await readJson<{
      force: boolean
      sourceIds: string[]
    }>()
    void runSongUpdatesInWorker({ force, sourceIds })
    return respond(202, { data: getSongUpdatesState() })
  }

  if (
    req.method === 'POST' &&
    pathname === '/api/song-sources/updates/cancel'
  ) {
    const denied = deny('songs.create')
    if (denied) return denied
    cancelSongUpdates()
    return respond(200, { data: getSongUpdatesState() })
  }

  if (req.method === 'POST' && pathname === '/api/song-sources/updates/sync') {
    const denied = deny('songs.create')
    if (denied) return denied
    if (getSongUpdatesState().running) {
      return respond(409, { error: 'The song sources are being checked' })
    }
    syncPendingSongs()
    return respond(200, { data: getSongUpdatesState() })
  }

  if (
    req.method === 'PUT' &&
    pathname === '/api/song-sources/updates/settings'
  ) {
    const denied = deny('settings.edit')
    if (denied) return denied
    const { autoUpdate } = await readJson<{ autoUpdate: boolean }>()
    if (typeof autoUpdate !== 'boolean') {
      return respond(400, { error: 'autoUpdate must be true or false' })
    }
    setAutoUpdateSongs(autoUpdate)
    return respond(200, { data: getSongUpdatesState() })
  }

  const lackingId = pathname.match(SOURCE_LACKING_PATH)?.[1]
  if (req.method === 'GET' && lackingId) {
    return (
      deny('songs.create') ??
      respond(200, { data: readLackingSongs(lackingId) })
    )
  }

  const changedId = pathname.match(SOURCE_CHANGED_PATH)?.[1]
  if (req.method === 'GET' && changedId) {
    const denied = deny('songs.create')
    if (denied) return denied
    try {
      return respond(200, { data: readChangedForReview(changedId) })
    } catch (error) {
      return respond(404, { error: errorMessage(error) })
    }
  }
  if (req.method === 'POST' && changedId) {
    const denied = deny('songs.create')
    if (denied) return denied
    const { songIds, action } = await readJson<{
      songIds: number[]
      action: 'update' | 'keep'
    }>()
    if (!Array.isArray(songIds) || (action !== 'update' && action !== 'keep')) {
      return respond(400, {
        error:
          "songIds (an array) and action ('update' or 'keep') are required",
      })
    }
    if (getSongUpdatesState().running) {
      return respond(409, { error: 'The song sources are being checked' })
    }
    try {
      resolveChangedSongs(changedId, songIds, action)
      return respond(200, { data: getSongUpdatesState() })
    } catch (error) {
      return respond(404, { error: errorMessage(error) })
    }
  }

  const recountId = pathname.match(SOURCE_RECOUNT_PATH)?.[1]
  if (req.method === 'POST' && recountId) {
    const denied = deny('songs.create')
    if (denied) return denied
    try {
      recountSourceSongs(recountId)
      return respond(200, { data: getSongUpdatesState() })
    } catch (error) {
      return respond(404, { error: errorMessage(error) })
    }
  }

  if (req.method === 'POST' && pathname === '/api/song-sources') {
    const denied = deny('songs.create')
    if (denied) return denied
    const { url: link } = await readJson<{ url: string }>()
    if (!link) return respond(400, { error: 'url is required' })
    try {
      return respond(200, { data: await upsertLinkSource(link) })
    } catch (error) {
      return respond(400, { error: errorMessage(error) })
    }
  }

  if (req.method === 'GET' && pathname === '/api/song-sources/export') {
    const denied = deny('songs.view')
    if (denied) return denied
    const categoryId = Number(url.searchParams.get('categoryId'))
    const categoryName = getCategoryById(categoryId)?.name
    if (!categoryName) return respond(404, { error: 'Category not found' })
    const bundle = buildBundleFiles(categoryId, {
      name: categoryName,
      categoryName,
    })
    const file = await zipBundleFiles(bundle)
    return handleCors(
      req,
      new Response(file.slice(), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(bundleFileName(categoryName, url.searchParams.get('format')))}`,
        },
      }),
    )
  }

  if (pathname === '/api/song-sources/storage') {
    if (req.method === 'GET') {
      const denied = deny('settings.view')
      if (denied) return denied
      const storage = getS3Storage()
      return respond(200, { data: storage ? toS3StorageView(storage) : null })
    }
    if (req.method === 'PUT') {
      const denied = deny('settings.edit')
      if (denied) return denied
      try {
        const storage = upsertS3Storage(
          (await readJson<S3StorageInput>()) as S3StorageInput,
        )
        return respond(200, { data: toS3StorageView(storage) })
      } catch (error) {
        return respond(400, { error: errorMessage(error) })
      }
    }
  }

  if (pathname === '/api/song-sources/shares') {
    if (req.method === 'GET') {
      const denied = deny('settings.view')
      if (denied) return denied
      return respond(200, {
        data: listShares(),
        cloudSync: (await getCloudIdentity()) !== null,
      })
    }
    if (req.method === 'POST') {
      const denied = deny('settings.edit')
      if (denied) return denied
      return saveShareRoute(await readJson<LibraryShareInput>())
    }
  }

  const shareSyncMatch = pathname.match(SHARE_SYNC_PATH)
  if (req.method === 'POST' && shareSyncMatch) {
    const denied = deny('settings.edit')
    if (denied) return denied
    const id = Number(shareSyncMatch[1])
    if (!getShare(id)) return respond(404, { error: 'Share not found' })
    try {
      await publishShare(id, { force: true })
    } catch (error) {
      logger.warning(`Sharing the songs failed: ${error}`)
      return respond(502, { error: errorMessage(error), data: getShare(id) })
    }
    return respond(200, { data: getShare(id) })
  }

  const shareMatch = pathname.match(SHARE_PATH)
  if (shareMatch && req.method === 'PUT') {
    const denied = deny('settings.edit')
    if (denied) return denied
    return saveShareRoute(
      await readJson<LibraryShareInput>(),
      Number(shareMatch[1]),
    )
  }
  if (shareMatch && req.method === 'DELETE') {
    const denied = deny('settings.edit')
    if (denied) return denied
    try {
      await deleteShare(Number(shareMatch[1]))
    } catch (error) {
      logger.warning(`Stopping the share failed: ${error}`)
      return respond(502, { error: errorMessage(error) })
    }
    return respond(200, { data: null })
  }

  if (req.method === 'GET' && pathname === '/api/song-sources/catalog') {
    const denied = deny('songs.view')
    if (denied) return denied
    try {
      return respond(200, { data: await readCatalog() })
    } catch (error) {
      logger.warning(`Reading the library catalog failed: ${error}`)
      return respond(502, { error: errorMessage(error) })
    }
  }

  if (pathname === '/api/song-sources/publications') {
    if (req.method === 'GET') {
      return deny('settings.view') ?? respond(200, { data: publicationsView() })
    }
    if (req.method === 'POST') {
      const denied = deny('settings.edit')
      if (denied) return denied
      const { categoryId } = await readJson<{ categoryId: number }>()
      if (!categoryId) return respond(400, { error: 'categoryId is required' })
      if (!getS3Storage()) {
        return respond(400, { error: 'No S3 storage is configured' })
      }
      try {
        const id = upsertPublication(categoryId)
        await syncPublication(id)
      } catch (error) {
        logger.warning(`Publishing category ${categoryId} failed: ${error}`)
        return respond(502, { error: errorMessage(error) })
      }
      return respond(200, { data: publicationsView() })
    }
  }

  const syncMatch = pathname.match(PUBLICATION_SYNC_PATH)
  if (req.method === 'POST' && syncMatch) {
    const denied = deny('settings.edit')
    if (denied) return denied
    const id = Number(syncMatch[1])
    if (!getPublication(id)) {
      return respond(404, { error: 'Publication not found' })
    }
    try {
      await syncPublication(id)
    } catch (error) {
      logger.warning(`Syncing publication ${id} failed: ${error}`)
      return respond(502, { error: errorMessage(error) })
    }
    return respond(200, { data: publicationsView() })
  }

  const publicationMatch = pathname.match(PUBLICATION_PATH)
  if (req.method === 'DELETE' && publicationMatch) {
    const denied = deny('settings.edit')
    if (denied) return denied
    try {
      await deletePublication(Number(publicationMatch[1]))
    } catch (error) {
      logger.warning(`Unpublishing failed: ${error}`)
      return respond(502, { error: errorMessage(error) })
    }
    return respond(200, { data: publicationsView() })
  }

  const songsId = pathname.match(SOURCE_SONGS_PATH)?.[1]
  if (req.method === 'GET' && songsId) {
    const denied = deny('songs.create')
    if (denied) return denied
    try {
      return respond(200, { data: await readSourceSongs(songsId) })
    } catch (error) {
      logger.warning(`Reading source ${songsId} failed: ${error}`)
      return respond(502, { error: errorMessage(error) })
    }
  }

  const archiveId = pathname.match(SOURCE_ARCHIVE_PATH)?.[1]
  if (req.method === 'GET' && archiveId) {
    const denied = deny('songs.create')
    if (denied) return denied
    try {
      const archive = await readSourceArchive(archiveId)
      return handleCors(
        req,
        new Response(archive.slice(), {
          headers: {
            'Content-Type': 'application/zip',
            'Content-Length': String(archive.byteLength),
          },
        }),
      )
    } catch (error) {
      logger.warning(`Reading source ${archiveId} failed: ${error}`)
      return respond(502, { error: errorMessage(error) })
    }
  }

  const checksumId = pathname.match(SOURCE_CHECKSUM_PATH)?.[1]
  if (req.method === 'GET' && checksumId) {
    const denied = deny('songs.view')
    if (denied) return denied
    try {
      return respond(200, {
        data: { checksum: await readSourceChecksum(checksumId) },
      })
    } catch (error) {
      logger.warning(`Checksum of ${checksumId} failed: ${error}`)
      return respond(502, { error: errorMessage(error) })
    }
  }

  const sourceId = pathname.match(SOURCE_PATH)?.[1]
  if (req.method === 'DELETE' && sourceId) {
    const denied = deny('songs.create')
    if (denied) return denied
    deleteLinkSource(sourceId)
    return respond(200, { data: listSongSources() })
  }

  return null
}
