import {
  type CuratorDecision,
  decideLibrarySubmission,
  getCuratorStatus,
  getFeaturedSources,
  listLibrarySubmissions,
  saveFeaturedSources,
  searchLibrarySongs,
  submitSongsToLibrary,
} from '../service/song-library'
import type { Permission } from '../service/users/types'
import { createLogger } from '../utils/logger'
import { toErrorMessage } from '../utils/toErrorMessage'

const logger = createLogger('song-library')

const SUBMIT_PATH = '/api/song-library-submissions'
const DECISION_PATH =
  /^\/api\/song-library\/submissions\/([A-Za-z0-9_-]{1,64})\/decision$/

/** Errors the user acts on, with their status. */
const STATUS_BY_ERROR: Record<string, number> = {
  owner_sign_in_required: 401,
  song_not_found: 404,
  submission_not_found: 404,
  library_song_not_found: 404,
  too_many_songs: 413,
}

/**
 * A failed request: the user's own errors as mapped, the service's
 * refusals (401 sign in again, 403 not a curator, 429 too many…) with
 * their status and code, anything else 502.
 */
function failure(error: unknown): Response {
  const message = toErrorMessage(error)
  const refused = message.match(/^Sync service (4\d\d)(?: (\w+))?/)
  const status = STATUS_BY_ERROR[message] ?? (Number(refused?.[1]) || 502)
  if (status === 502) logger.error(`Song library request failed: ${message}`)
  return Response.json(
    { error: message, code: refused?.[2] ?? message },
    { status },
  )
}

async function answer(work: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json({ data: await work() })
  } catch (error) {
    return failure(error)
  }
}

/** The whole numbers of a list from the body (none when it is not one). */
function integers(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => Number.isInteger(item))
    : []
}

function parseDecision(body: Record<string, unknown>): CuratorDecision | null {
  if (body.decision === 'approved') return { decision: 'approved' }
  if (body.decision === 'merged' && typeof body.librarySongId === 'string') {
    return { decision: 'merged', librarySongId: body.librarySongId }
  }
  if (body.decision === 'rejected') {
    const reason =
      typeof body.reason === 'string' && body.reason.trim()
        ? body.reason.trim()
        : null
    return { decision: 'rejected', reason }
  }
  return null
}

/**
 * The curated Church Hub Library (T-177), through the sync service:
 * POST /api/song-library-submissions              { songIds?, categoryIds?, note? } → submitted (songs.edit)
 * GET  /api/song-library/curator                   → who curates on this PC
 * GET  /api/song-library/submissions               → the queue, with slides and likely duplicates
 * GET  /api/song-library/songs?q=                  → library songs to merge into
 * POST /api/song-library/submissions/:id/decision  { decision, librarySongId?, reason? }
 * GET  /api/song-library/featured                  → the sources every app is offered
 * PUT  /api/song-library/featured                  { sources } → published (a curator)
 * The curator's routes are localhost only with users.edit, like the
 * owner's: the account signs in with Google (owner sign-in, intent curate).
 */
export async function handleSongLibraryRoutes(
  req: Request,
  url: URL,
  localhostGuard: () => Response | null,
  checkPermission: (permission: Permission) => Response | null,
): Promise<Response | null> {
  const { pathname } = url
  if (pathname === SUBMIT_PATH && req.method === 'POST') {
    const denied = checkPermission('songs.edit')
    if (denied) return denied
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const songIds = integers(body.songIds)
    const categoryIds = integers(body.categoryIds)
    if (songIds.length === 0 && categoryIds.length === 0) {
      return Response.json(
        { error: 'songIds or categoryIds is required' },
        { status: 400 },
      )
    }
    const note =
      typeof body.note === 'string' && body.note.trim()
        ? body.note.trim().slice(0, 1000)
        : null
    return answer(() => submitSongsToLibrary({ songIds, categoryIds }, note))
  }

  if (!pathname.startsWith('/api/song-library/')) return null
  const denied = localhostGuard() ?? checkPermission('users.edit')
  if (denied) return denied

  if (pathname === '/api/song-library/curator' && req.method === 'GET') {
    return answer(getCuratorStatus)
  }
  if (pathname === '/api/song-library/submissions' && req.method === 'GET') {
    return answer(listLibrarySubmissions)
  }
  if (pathname === '/api/song-library/songs' && req.method === 'GET') {
    return answer(() => searchLibrarySongs(url.searchParams.get('q') ?? ''))
  }
  if (pathname === '/api/song-library/featured') {
    if (req.method === 'GET') {
      return Response.json({ data: getFeaturedSources() })
    }
    if (req.method === 'PUT') {
      const body = (await req.json().catch(() => ({}))) as { sources?: unknown }
      if (!Array.isArray(body.sources)) {
        return Response.json({ error: 'sources is required' }, { status: 400 })
      }
      return answer(() =>
        saveFeaturedSources(
          body.sources as Parameters<typeof saveFeaturedSources>[0],
        ),
      )
    }
  }
  const decision = pathname.match(DECISION_PATH)
  if (decision && req.method === 'POST') {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const input = parseDecision(body)
    if (!input) {
      return Response.json(
        {
          error:
            'decision must be approved, merged (with librarySongId) or rejected',
        },
        { status: 400 },
      )
    }
    return answer(() => decideLibrarySubmission(decision[1] as string, input))
  }
  return null
}
