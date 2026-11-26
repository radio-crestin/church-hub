import {
  deviceLoginRetryAfter,
  recordDeviceLoginFailure,
} from '../service/sync/cloud/deviceLoginLimiter'
import { openDeviceSession } from '../service/sync/cloud/deviceSessions'
import { identifyCloudDevice } from '../service/sync/cloud/identifyCloudDevice'
import { getUserById } from '../service/users'
import { ALL_PERMISSIONS } from '../service/users/types'
import { authLogger } from '../utils/fileLogger'
import { getRequestPeer } from '../utils/request-peer'
import { toErrorMessage } from '../utils/toErrorMessage'

/**
 * POST /api/auth/device-login { token } → { data: user, token }
 * A phone that joined the church with a link (T-168) and reaches this
 * server over WebRTC (T-174) signs in with its cloud device token: the sync
 * service says whose it is, and the phone gets a session of that device,
 * sent back as `X-User-Auth` (a tunnel carries no cookies). The session
 * ends when the device is revoked (deviceSessions). A revoked token, an
 * unknown user or an inactive one is refused; five refusals a minute from
 * one address answer 429.
 */
export async function handleDeviceLogin(req: Request): Promise<Response> {
  const peer = getRequestPeer(req) ?? 'unknown'
  const retryAfter = deviceLoginRetryAfter(peer)
  if (retryAfter > 0) {
    authLogger.warn('Device login throttled', { peer, retryAfter })
    return Response.json(
      { error: 'Too many failed device logins' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }
  const body = (await req.json().catch(() => null)) as {
    token?: unknown
  } | null
  if (typeof body?.token !== 'string' || !body.token) {
    return Response.json({ error: 'Missing token' }, { status: 400 })
  }
  let owner: Awaited<ReturnType<typeof identifyCloudDevice>>
  try {
    owner = await identifyCloudDevice(body.token)
  } catch (error) {
    authLogger.warn('Device login: sync service unreachable', {
      error: toErrorMessage(error),
    })
    return Response.json({ error: 'Sync service unreachable' }, { status: 502 })
  }
  const user = owner ? getUserById(owner.userId) : null
  if (!owner || !user?.isActive) {
    recordDeviceLoginFailure(peer)
    authLogger.warn('Device login refused', { peer, userId: owner?.userId })
    return Response.json({ error: 'Invalid device token' }, { status: 401 })
  }
  authLogger.info('Device login', {
    userId: user.id,
    userName: user.name,
    deviceId: owner.deviceId,
  })
  return Response.json({
    data: {
      id: user.id,
      name: user.name,
      isApp: user.isSuperAdmin,
      permissions: user.isSuperAdmin ? ALL_PERMISSIONS : user.permissions,
    },
    token: openDeviceSession(owner, body.token),
  })
}
