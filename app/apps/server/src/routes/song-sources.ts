import { sanitizeFilename } from '@church-hub/song-formats'

import { requirePermission } from '../middleware/permissions'
import type { RequestContext } from '../middleware/types'
import {
  buildBundleFiles,
  deleteLinkSource,
  deletePublication,
  getPublication,
  getS3Storage,
  listPublications,
  listSongSources,
  readSourceArchive,
  readSourceChecksum,
  readSourceSongs,
  type S3StorageInput,
  SONG_BUNDLE_EXTENSION,
  syncPublication,
  toPublicationView,
  toS3StorageView,
  upsertLinkSource,
  upsertPublication,
  upsertS3Storage,
  zipBundleFiles,
} from '../service/song-sources'
import { getCategoryById } from '../service/songs'
import type { Permission } from '../service/users'
import { createLogger } from '../utils/logger'

type HandleCors = (req: Request, res: Response) => Response

const logger = createLogger('song-sources')

const SOURCE_SONGS_PATH = /^\/api\/song-sources\/([\w-]+)\/songs$/
const SOURCE_ARCHIVE_PATH = /^\/api\/song-sources\/([\w-]+)\/archive$/
const SOURCE_CHECKSUM_PATH = /^\/api\/song-sources\/([\w-]+)\/checksum$/
const SOURCE_PATH = /^\/api\/song-sources\/([\w-]+)$/
const PUBLICATION_SYNC_PATH = /^\/api\/song-sources\/publications\/(\d+)\/sync$/
const PUBLICATION_PATH = /^\/api\/song-sources\/publications\/(\d+)$/

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

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
 * - GET    /api/song-sources/export?categoryId=&format=chsongs|zip  a category as a song bundle (songs.view)
 * - GET    /api/song-sources/storage             the S3 storage, without its secret (settings.view)
 * - PUT    /api/song-sources/storage             save the S3 storage (settings.edit)
 * - GET    /api/song-sources/publications        published categories (settings.view)
 * - POST   /api/song-sources/publications        publish a category `{ categoryId }` (settings.edit)
 * - POST   /api/song-sources/publications/:id/sync   upload its changes now (settings.edit)
 * - DELETE /api/song-sources/publications/:id    stop publishing, delete its files (settings.edit)
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

  if (req.method === 'GET' && pathname === '/api/song-sources') {
    return deny('songs.view') ?? respond(200, { data: listSongSources() })
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
      new Response(file, {
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

  const songsMatch = pathname.match(SOURCE_SONGS_PATH)
  if (req.method === 'GET' && songsMatch) {
    const denied = deny('songs.create')
    if (denied) return denied
    try {
      return respond(200, { data: await readSourceSongs(songsMatch[1]) })
    } catch (error) {
      logger.warning(`Reading source ${songsMatch[1]} failed: ${error}`)
      return respond(502, { error: errorMessage(error) })
    }
  }

  const archiveMatch = pathname.match(SOURCE_ARCHIVE_PATH)
  if (req.method === 'GET' && archiveMatch) {
    const denied = deny('songs.create')
    if (denied) return denied
    try {
      const archive = await readSourceArchive(archiveMatch[1])
      return handleCors(
        req,
        new Response(archive, {
          headers: {
            'Content-Type': 'application/zip',
            'Content-Length': String(archive.byteLength),
          },
        }),
      )
    } catch (error) {
      logger.warning(`Reading source ${archiveMatch[1]} failed: ${error}`)
      return respond(502, { error: errorMessage(error) })
    }
  }

  const checksumMatch = pathname.match(SOURCE_CHECKSUM_PATH)
  if (req.method === 'GET' && checksumMatch) {
    const denied = deny('songs.view')
    if (denied) return denied
    try {
      return respond(200, {
        data: { checksum: await readSourceChecksum(checksumMatch[1]) },
      })
    } catch (error) {
      logger.warning(`Checksum of ${checksumMatch[1]} failed: ${error}`)
      return respond(502, { error: errorMessage(error) })
    }
  }

  const sourceMatch = pathname.match(SOURCE_PATH)
  if (req.method === 'DELETE' && sourceMatch) {
    const denied = deny('songs.create')
    if (denied) return denied
    deleteLinkSource(sourceMatch[1])
    return respond(200, { data: listSongSources() })
  }

  return null
}
