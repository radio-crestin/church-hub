import { requirePermission } from '../middleware/permissions'
import type { RequestContext } from '../middleware/types'
import { refreshPresentedSongSlides } from '../service/presentation'
import {
  getSongHistoryEntry,
  listSongHistory,
  resolveSongEditor,
  restoreSongVersion,
} from '../service/song-history'
import { updateSearchIndex } from '../service/songs'
import type { Permission } from '../service/users'
import { broadcastPresentationState, broadcastSongUpdated } from '../websocket'

type HandleCors = (req: Request, res: Response) => Response

const HISTORY_PATH_REGEX = /^\/api\/songs\/(\d+)\/history$/
const HISTORY_ENTRY_PATH_REGEX = /^\/api\/songs\/(\d+)\/history\/(\d+)$/
const RESTORE_PATH_REGEX = /^\/api\/songs\/(\d+)\/history\/(\d+)\/restore$/

/**
 * Per-song edit history.
 *
 * - GET  /api/songs/:id/history              entries, newest first (no snapshots)
 * - GET  /api/songs/:id/history/:entryId     one entry with before/after snapshots
 * - POST /api/songs/:id/history/:entryId/restore   body `{ side: 'before' | 'after' }`
 *
 * Reading needs `songs.view`; restoring needs `songs.edit`.
 */
export async function handleSongHistoryRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
  context: RequestContext | null,
): Promise<Response | null> {
  const { pathname } = url
  if (!pathname.startsWith('/api/songs/') || !pathname.includes('/history')) {
    return null
  }

  const respond = (status: number, payload: unknown): Response =>
    handleCors(
      req,
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

  const checkPermission = (permission: Permission): Response | null => {
    if (!context) return respond(401, { error: 'Unauthorized' })
    const denied = requirePermission(permission)(context)
    return denied ? handleCors(req, denied) : null
  }

  const listMatch = pathname.match(HISTORY_PATH_REGEX)
  if (req.method === 'GET' && listMatch?.[1]) {
    const denied = checkPermission('songs.view')
    if (denied) return denied
    return respond(200, { data: listSongHistory(Number(listMatch[1])) })
  }

  const entryMatch = pathname.match(HISTORY_ENTRY_PATH_REGEX)
  if (req.method === 'GET' && entryMatch?.[1] && entryMatch[2]) {
    const denied = checkPermission('songs.view')
    if (denied) return denied
    const entry = getSongHistoryEntry(
      Number(entryMatch[1]),
      Number(entryMatch[2]),
    )
    if (!entry) return respond(404, { error: 'History entry not found' })
    return respond(200, { data: entry })
  }

  const restoreMatch = pathname.match(RESTORE_PATH_REGEX)
  if (req.method === 'POST' && restoreMatch?.[1] && restoreMatch[2]) {
    const denied = checkPermission('songs.edit')
    if (denied) return denied

    const body = (await req.json().catch(() => null)) as {
      side?: string
    } | null
    if (body?.side !== 'before' && body?.side !== 'after') {
      return respond(400, { error: "side must be 'before' or 'after'" })
    }

    const songId = Number(restoreMatch[1])
    const song = restoreSongVersion(
      songId,
      Number(restoreMatch[2]),
      body.side,
      resolveSongEditor(context?.userId),
    )
    if (!song) return respond(404, { error: 'History version not found' })

    updateSearchIndex(songId)
    broadcastSongUpdated(songId)
    const refreshedState = refreshPresentedSongSlides(songId)
    if (refreshedState) broadcastPresentationState(refreshedState)

    return respond(200, { data: song })
  }

  return null
}
