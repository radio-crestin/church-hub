import {
  BackgroundMediaError,
  getGalleryMediaRef,
} from '../service/background-media'
import type { PresentationState } from '../service/presentation'
import { presentTemporaryImage } from '../service/presentation/presentTemporaryImage'
import { presentTemporaryVideo } from '../service/presentation/presentTemporaryVideo'
import { endScreenShareSession } from '../service/screen-share'
import type { Permission } from '../service/users/types'
import { createLogger } from '../utils/logger'

const logger = createLogger('presentation-gallery-media')

type HandleCors = (req: Request, res: Response) => Response
type CheckPermission = (permission: Permission) => Response | null

const PRESENTERS = {
  '/api/presentation/temporary-image': (mediaId: unknown) =>
    presentTemporaryImage(getGalleryMediaRef(mediaId, 'image')),
  '/api/presentation/temporary-video': (mediaId: unknown) =>
    presentTemporaryVideo(getGalleryMediaRef(mediaId, 'video')),
} as const

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * POST /api/presentation/temporary-image and /temporary-video: a gallery file
 * full screen on the displays, presented on its own from the gallery.
 */
export async function handlePresentationGalleryMediaRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
  checkPermission: CheckPermission,
  onPresented: (state: PresentationState) => void,
): Promise<Response | null> {
  if (req.method !== 'POST' || !(url.pathname in PRESENTERS)) return null
  const present = PRESENTERS[url.pathname as keyof typeof PRESENTERS]

  const permError = checkPermission('control_room.control')
  if (permError) return permError

  const body = (await req.json().catch(() => null)) as {
    mediaId?: unknown
  } | null
  try {
    const state = present(body?.mediaId)
    // The file replaced any screen share on the screens.
    endScreenShareSession()
    onPresented(state)
    return handleCors(req, json({ data: state }))
  } catch (error) {
    if (!(error instanceof BackgroundMediaError)) throw error
    logger.warning(`${url.pathname} refused: ${error.message}`)
    return handleCors(req, json({ error: error.message }, error.status))
  }
}
