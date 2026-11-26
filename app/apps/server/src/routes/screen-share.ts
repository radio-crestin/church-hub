import type { CheckPermission } from '../middleware/route-permissions'
import {
  clearTemporaryContent,
  getPresentationState,
  presentTemporaryScreenShare,
} from '../service/presentation'
import {
  acceptFrame,
  endScreenShareSession,
  isScreenShareActive,
  openMjpegStream,
  startScreenShareSession,
} from '../service/screen-share'
import { createLogger } from '../utils/logger'
import { broadcastPresentationState } from '../websocket'

const logger = createLogger('screen-share')

type HandleCors = (req: Request, res: Response) => Response

/** A 4K frame as JPEG is well under this; more is not a frame. */
const MAX_FRAME_BYTES = 8 * 1024 * 1024

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Takes the share off the screens if it is what they show. */
function clearScreenShareContent() {
  if (getPresentationState().temporaryContent?.type !== 'screen_share') return
  broadcastPresentationState(clearTemporaryContent())
}

export async function handleScreenShareRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
  checkPermission: CheckPermission,
): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/screen-share/')) return null

  // POST /api/screen-share/start - Put the share on the screens, get the ingest token
  if (req.method === 'POST' && url.pathname === '/api/screen-share/start') {
    const permError = checkPermission('control_room.control')
    if (permError) return permError
    const body = (await req.json().catch(() => ({}))) as {
      scheduleId?: number
      scheduleItemIndex?: number
    }
    const token = startScreenShareSession(clearScreenShareContent)
    const state = presentTemporaryScreenShare({
      scheduleId: body.scheduleId,
      scheduleItemIndex: body.scheduleItemIndex,
    })
    broadcastPresentationState(state)
    return handleCors(req, json({ data: { token } }))
  }

  // POST /api/screen-share/stop - End the share and take it off the screens
  if (req.method === 'POST' && url.pathname === '/api/screen-share/stop') {
    const permError = checkPermission('control_room.control')
    if (permError) return permError
    endScreenShareSession()
    clearScreenShareContent()
    return handleCors(req, json({ data: getPresentationState() }))
  }

  // POST /api/screen-share/frame - One JPEG frame from the sharer
  if (req.method === 'POST' && url.pathname === '/api/screen-share/frame') {
    // Other content replaced the share on the screens: the sharer stops.
    if (
      isScreenShareActive() &&
      getPresentationState().temporaryContent?.type !== 'screen_share'
    ) {
      endScreenShareSession()
    }
    const jpeg = new Uint8Array(await req.arrayBuffer())
    if (jpeg.byteLength === 0 || jpeg.byteLength > MAX_FRAME_BYTES) {
      return handleCors(req, json({ error: 'Invalid frame size' }, 413))
    }
    const result = acceptFrame(req.headers.get('X-Screen-Share-Token'), jpeg)
    if (result === 'no_session') {
      return handleCors(req, json({ error: 'No screen share running' }, 409))
    }
    if (result === 'bad_token') {
      logger.warning('Frame refused: wrong ingest token')
      return handleCors(req, json({ error: 'Invalid screen share token' }, 403))
    }
    return handleCors(req, new Response(null, { status: 204 }))
  }

  // GET /api/screen-share/stream.mjpg - The share as an MJPEG stream for <img>
  if (
    req.method === 'GET' &&
    url.pathname === '/api/screen-share/stream.mjpg'
  ) {
    const permError = checkPermission('displays.view')
    if (permError) return permError
    if (!isScreenShareActive()) {
      return handleCors(req, json({ error: 'No screen share running' }, 404))
    }
    return handleCors(req, openMjpegStream())
  }

  return null
}
