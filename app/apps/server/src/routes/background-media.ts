import { requirePermission } from '../middleware/permissions'
import type { RequestContext } from '../middleware/types'
import {
  BACKGROUND_MEDIA_URL_PREFIX,
  BackgroundMediaError,
  deleteBackgroundMedia,
  listBackgroundMedia,
  saveBackgroundMedia,
  serveBackgroundMedia,
} from '../service/background-media'
import type { Permission } from '../service/users'
import { createLogger } from '../utils/logger'

type HandleCors = (req: Request, res: Response) => Response

const logger = createLogger('background-media')

const MEDIA_ITEM_PATH_REGEX = /^\/api\/media\/backgrounds\/([^/]+)$/

/**
 * Screen background uploads (images/videos shown behind presentation content).
 *
 * - POST   /api/media/backgrounds      raw file body → 201 BackgroundMedia
 * - GET    /api/media/backgrounds      list, newest first
 * - GET    /api/media/backgrounds/:id  file bytes (Range/HEAD supported)
 * - DELETE /api/media/backgrounds/:id
 *
 * Reads need `displays.view` — the same permission `GET /api/screens/:id`
 * requires, so every display that can load a screen config (including
 * cookie-less localhost projector windows, which get the view-only
 * permission set) can load the backgrounds it references via <img>/<video>.
 * Writes need `displays.edit`, like the screen config updates that store the
 * returned URL.
 */
export async function handleBackgroundMediaRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
  context: RequestContext | null,
): Promise<Response | null> {
  const { pathname } = url
  if (
    pathname !== BACKGROUND_MEDIA_URL_PREFIX &&
    !pathname.startsWith(`${BACKGROUND_MEDIA_URL_PREFIX}/`)
  ) {
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
    if (!context) {
      return respond(401, { error: 'Unauthorized' })
    }
    const denied = requirePermission(permission)(context)
    return denied ? handleCors(req, denied) : null
  }

  const itemId = pathname.match(MEDIA_ITEM_PATH_REGEX)?.[1]

  try {
    // POST /api/media/backgrounds - Upload a background (raw body)
    if (req.method === 'POST' && pathname === BACKGROUND_MEDIA_URL_PREFIX) {
      const permError = checkPermission('displays.edit')
      if (permError) return permError

      const media = await saveBackgroundMedia({
        body: req.body,
        contentType: req.headers.get('Content-Type'),
        contentLength: req.headers.get('Content-Length'),
        originalName: url.searchParams.get('name'),
      })
      return respond(201, { data: media })
    }

    // GET /api/media/backgrounds - List uploaded backgrounds
    if (req.method === 'GET' && pathname === BACKGROUND_MEDIA_URL_PREFIX) {
      const permError = checkPermission('displays.view')
      if (permError) return permError

      return respond(200, { data: await listBackgroundMedia() })
    }

    // GET|HEAD /api/media/backgrounds/:id - Serve the file (Range aware)
    if ((req.method === 'GET' || req.method === 'HEAD') && itemId) {
      const permError = checkPermission('displays.view')
      if (permError) return permError

      const response = await serveBackgroundMedia(
        itemId,
        req.headers.get('Range'),
        req.method === 'HEAD',
      )
      return handleCors(req, response)
    }

    // DELETE /api/media/backgrounds/:id - Delete a background
    if (req.method === 'DELETE' && itemId) {
      const permError = checkPermission('displays.edit')
      if (permError) return permError

      await deleteBackgroundMedia(itemId)
      return respond(200, { data: { success: true } })
    }
  } catch (error) {
    if (error instanceof BackgroundMediaError) {
      return respond(error.status, { error: error.message })
    }
    logger.error(`${req.method} ${pathname} failed: ${error}`)
    return respond(500, { error: 'Background media request failed' })
  }

  return null
}
