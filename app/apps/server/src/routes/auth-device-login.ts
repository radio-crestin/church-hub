import { identifyCloudDevice } from '../service/sync/cloud/identifyCloudDevice'
import { getUserById } from '../service/users'
import { ALL_PERMISSIONS } from '../service/users/types'
import { authLogger } from '../utils/fileLogger'
import { toErrorMessage } from '../utils/toErrorMessage'

/**
 * POST /api/auth/device-login { token } → { data: user, token }
 * A phone that joined the church with a link (T-168) and reaches this
 * server over WebRTC (T-174) signs in with its cloud device token: the sync
 * service says whose it is, and the phone gets that user's session token,
 * sent back as `X-User-Auth` (a tunnel carries no cookies). A revoked token,
 * an unknown user or an inactive one is refused.
 */
export async function handleDeviceLogin(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    token?: unknown
  } | null
  if (typeof body?.token !== 'string' || !body.token) {
    return Response.json({ error: 'Missing token' }, { status: 400 })
  }
  let userId: number | null
  try {
    userId = await identifyCloudDevice(body.token)
  } catch (error) {
    authLogger.warn('Device login: sync service unreachable', {
      error: toErrorMessage(error),
    })
    return Response.json({ error: 'Sync service unreachable' }, { status: 502 })
  }
  const user = userId === null ? null : getUserById(userId)
  if (!user?.isActive) {
    authLogger.warn('Device login refused', { userId })
    return Response.json({ error: 'Invalid device token' }, { status: 401 })
  }
  authLogger.info('Device login', { userId: user.id, userName: user.name })
  return Response.json({
    data: {
      id: user.id,
      name: user.name,
      isApp: user.isSuperAdmin,
      permissions: user.isSuperAdmin ? ALL_PERMISSIONS : user.permissions,
    },
    token: user.token,
  })
}
