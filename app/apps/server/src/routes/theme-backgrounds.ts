import { requirePermission } from '../middleware/permissions'
import type { RequestContext } from '../middleware/types'
import { BackgroundMediaError } from '../service/background-media/BackgroundMediaError'
import { THEME_BACKGROUNDS_URL_PREFIX } from '../service/slide-templates/theme-backgrounds/constants'
import { serveThemeBackground } from '../service/slide-templates/theme-backgrounds/serveThemeBackground'
import { createLogger } from '../utils/logger'

type HandleCors = (req: Request, res: Response) => Response

const logger = createLogger('theme-backgrounds')

const FILE_PATH_REGEX = /^\/api\/media\/theme-backgrounds\/([^/]+)$/

/**
 * GET|HEAD /api/media/theme-backgrounds/:file — the photos and videos the
 * built-in themes ship with (read-only, Range aware). Readable with
 * `displays.view`, like the uploaded backgrounds, so projector windows load
 * them.
 */
export async function handleThemeBackgroundRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
  context: RequestContext | null,
): Promise<Response | null> {
  if (!url.pathname.startsWith(`${THEME_BACKGROUNDS_URL_PREFIX}/`)) return null
  const fileName = url.pathname.match(FILE_PATH_REGEX)?.[1]
  if (!fileName || (req.method !== 'GET' && req.method !== 'HEAD')) return null

  const respond = (status: number, payload: unknown): Response =>
    handleCors(
      req,
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  if (!context) return respond(401, { error: 'Unauthorized' })
  const denied = requirePermission('displays.view')(context)
  if (denied) return handleCors(req, denied)

  try {
    const response = await serveThemeBackground(
      decodeURIComponent(fileName),
      req.headers.get('Range'),
      req.method === 'HEAD',
    )
    return handleCors(req, response)
  } catch (error) {
    if (error instanceof BackgroundMediaError) {
      return respond(error.status, { error: error.message })
    }
    logger.error(`${req.method} ${url.pathname} failed: ${error}`)
    return respond(500, { error: 'Theme background request failed' })
  }
}
