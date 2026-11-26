import {
  applyRemoteAccess,
  getRemoteAccessSettings,
  resetRemoteAccessSecret,
  setRemoteAccessEnabled,
} from '../service/remote-access'
import { getSignalingBaseUrl } from '../service/signaling/signalingBaseUrl'
import type { Permission } from '../service/users/types'

/**
 * Remote access (Settings > Phones): whether paired phones reach this
 * computer from anywhere over WebRTC, and the room secret in their QR code.
 * GET    /api/remote-access        → { enabled, secret, relay } (users.view)
 * PUT    /api/remote-access        { enabled } → settings   (users.edit)
 * POST   /api/remote-access/reset  → settings with a new secret (users.edit)
 */
export async function handleRemoteAccessRoutes(
  req: Request,
  url: URL,
  checkPermission: (permission: Permission) => Response | null,
): Promise<Response | null> {
  if (url.pathname === '/api/remote-access' && req.method === 'GET') {
    return checkPermission('users.view') ?? settingsResponse()
  }

  if (url.pathname === '/api/remote-access' && req.method === 'PUT') {
    const denied = checkPermission('users.edit')
    if (denied) return denied
    const body = (await req.json().catch(() => null)) as {
      enabled?: unknown
    } | null
    if (typeof body?.enabled !== 'boolean') {
      return Response.json(
        { error: 'enabled must be true or false' },
        { status: 400 },
      )
    }
    setRemoteAccessEnabled(body.enabled)
    await applyRemoteAccess()
    return settingsResponse()
  }

  if (url.pathname === '/api/remote-access/reset' && req.method === 'POST') {
    const denied = checkPermission('users.edit')
    if (denied) return denied
    resetRemoteAccessSecret()
    await applyRemoteAccess()
    return settingsResponse()
  }

  return null
}

/** The settings, and the relay a phone looks for this computer on. */
function settingsResponse() {
  const { enabled, secret } = getRemoteAccessSettings()
  return Response.json({
    data: { enabled, secret, relay: getSignalingBaseUrl() },
  })
}
