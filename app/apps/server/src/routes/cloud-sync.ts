import { handleCloudSyncOwnerRoutes } from './cloud-sync-owner'
import {
  addCloudDevice,
  connectCloudSync,
  disconnectCloudSync,
  listCloudDevices,
  revokeCloudDevice,
} from '../service/sync'
import type { Permission } from '../service/users/types'
import { createLogger } from '../utils/logger'
import { toErrorMessage } from '../utils/toErrorMessage'

const logger = createLogger('sync')

const DEVICE_PATH = /^\/api\/sync\/cloud\/devices\/([A-Za-z0-9_-]{1,64})$/

function failure(error: unknown): Response {
  const message = toErrorMessage(error)
  const status =
    message === 'already_connected' ||
    message === 'not_connected' ||
    message === 'server_in_use'
      ? 409
      : 502
  if (status === 502) logger.error(`Cloud sync request failed: ${message}`)
  return Response.json({ error: message }, { status })
}

/**
 * Cloud sync (T-171): this server's church on the sync service.
 * POST   /api/sync/cloud                     { serviceUrl? } → { churchId, readUrl } (localhost)
 * DELETE /api/sync/cloud                     → disconnected (localhost)
 * GET    /api/sync/cloud/devices             → the church's devices (users.edit)
 * POST   /api/sync/cloud/devices             { userId, name } → device token and join link (users.edit)
 * DELETE /api/sync/cloud/devices/:deviceId   → revoked, new read path (users.edit)
 */
export async function handleCloudSyncRoutes(
  req: Request,
  url: URL,
  localhostGuard: () => Response | null,
  checkPermission: (permission: Permission) => Response | null,
): Promise<Response | null> {
  if (
    url.pathname.startsWith('/api/sync/cloud/owner/') ||
    url.pathname === '/api/sync/cloud/keep'
  ) {
    return localhostGuard() ?? handleCloudSyncOwnerRoutes(req, url)
  }

  if (url.pathname === '/api/sync/cloud' && req.method === 'POST') {
    const denied = localhostGuard()
    if (denied) return denied
    const body = (await req.json().catch(() => ({}))) as {
      serviceUrl?: unknown
    }
    if (body.serviceUrl !== undefined && typeof body.serviceUrl !== 'string') {
      return Response.json(
        { error: 'serviceUrl must be a URL' },
        { status: 400 },
      )
    }
    try {
      // The first upload starts at once, in the background.
      const church = await connectCloudSync(body.serviceUrl || undefined)
      return Response.json({ data: church })
    } catch (error) {
      return failure(error)
    }
  }

  if (url.pathname === '/api/sync/cloud' && req.method === 'DELETE') {
    const denied = localhostGuard()
    if (denied) return denied
    await disconnectCloudSync()
    return Response.json({ data: { connected: false } })
  }

  if (url.pathname === '/api/sync/cloud/devices' && req.method === 'GET') {
    const denied = checkPermission('users.edit')
    if (denied) return denied
    try {
      return Response.json({ data: await listCloudDevices() })
    } catch (error) {
      return failure(error)
    }
  }

  if (url.pathname === '/api/sync/cloud/devices' && req.method === 'POST') {
    const denied = checkPermission('users.edit')
    if (denied) return denied
    const body = (await req.json().catch(() => ({}))) as {
      userId?: unknown
      name?: unknown
    }
    if (!Number.isInteger(body.userId) || typeof body.name !== 'string') {
      return Response.json(
        { error: 'userId and name are required' },
        { status: 400 },
      )
    }
    try {
      const device = await addCloudDevice({
        userId: body.userId as number,
        name: body.name.slice(0, 200),
      })
      return Response.json({ data: device }, { status: 201 })
    } catch (error) {
      return failure(error)
    }
  }

  const deviceMatch = url.pathname.match(DEVICE_PATH)
  if (deviceMatch?.[1] && req.method === 'DELETE') {
    const denied = checkPermission('users.edit')
    if (denied) return denied
    try {
      return Response.json({ data: await revokeCloudDevice(deviceMatch[1]) })
    } catch (error) {
      return failure(error)
    }
  }

  return null
}
