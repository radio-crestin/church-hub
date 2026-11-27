import {
  findSongByUuid,
  shareSongLink,
  unshareSongLink,
} from '../service/song-links'
import type { Permission } from '../service/users/types'
import { createLogger } from '../utils/logger'
import { toErrorMessage } from '../utils/toErrorMessage'

const logger = createLogger('song-links')

const SONG_PATH = /^\/api\/song-links\/(\d+)$/
const UUID_PATH = /^\/api\/song-links\/by-uuid\/([0-9A-Za-z-]{1,64})$/

/** Errors the user acts on, with their status. */
const STATUS_BY_ERROR: Record<string, number> = {
  cloud_sync_off: 409,
  song_not_found: 404,
}

/** The user's errors as mapped, the service's refusals as they came, else 502. */
function failure(error: unknown): Response {
  const message = toErrorMessage(error)
  const refused = message.match(/^Sync service (4\d\d)(?: (\w+))?/)
  const status = STATUS_BY_ERROR[message] ?? (Number(refused?.[1]) || 502)
  if (status === 502) logger.error(`Song link request failed: ${message}`)
  return Response.json(
    { error: message, code: refused?.[2] ?? message },
    { status },
  )
}

async function answer(work: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json({ data: (await work()) ?? null })
  } catch (error) {
    return failure(error)
  }
}

/**
 * Songs shared by a link (T-177), through the sync service:
 * POST   /api/song-links/:songId          → { url } its public page (songs.view)
 * DELETE /api/song-links/:songId          → the link stops (songs.view)
 * GET    /api/song-links/by-uuid/:uuid    → { songId } this device's copy of a shared song
 */
export async function handleSongLinkRoutes(
  req: Request,
  url: URL,
  checkPermission: (permission: Permission) => Response | null,
): Promise<Response | null> {
  const { pathname } = url
  if (!pathname.startsWith('/api/song-links/')) return null
  const denied = checkPermission('songs.view')
  if (denied) return denied

  const byUuid = pathname.match(UUID_PATH)
  if (byUuid && req.method === 'GET') {
    const found = findSongByUuid(byUuid[1] ?? '')
    return found
      ? Response.json({ data: found })
      : Response.json({ error: 'song_not_found' }, { status: 404 })
  }
  const song = pathname.match(SONG_PATH)
  if (song && req.method === 'POST') {
    return answer(() => shareSongLink(Number(song[1])))
  }
  if (song && req.method === 'DELETE') {
    return answer(() => unshareSongLink(Number(song[1])))
  }
  return null
}
