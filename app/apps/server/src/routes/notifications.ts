import { requirePermission } from '../middleware/permissions'
import type { RequestContext } from '../middleware/types'
import {
  deleteAllNotifications,
  deleteNotification,
  listNotifications,
  upsertNotification,
  upsertNotificationRead,
  upsertNotificationsRead,
} from '../service/notifications'

type HandleCors = (req: Request, res: Response) => Response

const NOTIFICATION_PATH = /^\/api\/notifications\/([^/]+)$/
const READ_PATH = /^\/api\/notifications\/([^/]+)\/read$/
const VERSION = /^[\w.+-]{1,40}$/

/**
 * The notifications history (the last 60 days), for any signed-in user;
 * the song sync's only for those who can see songs.
 *
 * - GET    /api/notifications              every notification, newest first
 * - POST   /api/notifications/read         mark them all read
 * - POST   /api/notifications/:id/read     mark one read (the user clicked it)
 * - POST   /api/notifications/app-update   record a new app version `{ version }`
 * - DELETE /api/notifications              remove all (those the user sees)
 * - DELETE /api/notifications/:id          remove one
 */
export async function handleNotificationRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
  context: RequestContext | null,
): Promise<Response | null> {
  const { pathname } = url
  if (!pathname.startsWith('/api/notifications')) return null

  const respond = (status: number, payload: unknown): Response =>
    handleCors(
      req,
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  if (!context) return respond(401, { error: 'Unauthorized' })

  const seesSongs = requirePermission('songs.view')(context) === null

  if (req.method === 'GET' && pathname === '/api/notifications') {
    const notifications = listNotifications().filter(
      (n) => seesSongs || !n.kind.startsWith('songs-'),
    )
    return respond(200, { data: notifications })
  }

  if (req.method === 'DELETE' && pathname === '/api/notifications') {
    const removed = deleteAllNotifications(seesSongs)
    return respond(200, { data: { removed } })
  }

  if (req.method === 'POST' && pathname === '/api/notifications/read') {
    upsertNotificationsRead()
    return respond(200, { data: { ok: true } })
  }

  if (req.method === 'POST' && pathname === '/api/notifications/app-update') {
    const body = (await req.json().catch(() => null)) as {
      version?: unknown
    } | null
    const version = body?.version
    if (typeof version !== 'string' || !VERSION.test(version)) {
      return respond(400, { error: 'version must be a version number' })
    }
    upsertNotification({
      id: `app-update:${version}`,
      kind: 'app-update',
      data: { version },
    })
    return respond(200, { data: { ok: true } })
  }

  // Ids hold a ':', so clients send them encoded.
  const encodedReadId = pathname.match(READ_PATH)?.[1]
  if (req.method === 'POST' && encodedReadId) {
    const id = decodeId(encodedReadId)
    if (id === null) return respond(400, { error: 'Not a notification id' })
    upsertNotificationRead(id)
    return respond(200, { data: { ok: true } })
  }

  const encodedId = pathname.match(NOTIFICATION_PATH)?.[1]
  if (req.method === 'DELETE' && encodedId) {
    const id = decodeId(encodedId)
    if (id === null) return respond(400, { error: 'Not a notification id' })
    return deleteNotification(id)
      ? respond(200, { data: { ok: true } })
      : respond(404, { error: 'Notification not found' })
  }

  return null
}

function decodeId(encoded: string): string | null {
  try {
    return decodeURIComponent(encoded)
  } catch {
    return null
  }
}
