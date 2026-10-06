import { requirePermission } from '../middleware/permissions'
import type { RequestContext } from '../middleware/types'
import { listSongSources } from '../service/song-sources'

type HandleCors = (req: Request, res: Response) => Response

/**
 * Song sources the discovery flow imports from.
 *
 * - GET /api/song-sources   every source, built-in first (needs `songs.view`)
 */
export async function handleSongSourceRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
  context: RequestContext | null,
): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/song-sources')) return null

  const respond = (status: number, payload: unknown): Response =>
    handleCors(
      req,
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

  if (!context) return respond(401, { error: 'Unauthorized' })

  if (req.method === 'GET' && url.pathname === '/api/song-sources') {
    const denied = requirePermission('songs.view')(context)
    if (denied) return handleCors(req, denied)
    return respond(200, { data: listSongSources() })
  }

  return null
}
