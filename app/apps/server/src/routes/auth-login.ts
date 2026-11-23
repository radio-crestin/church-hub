import { isLocalhost } from '../middleware/auth'
import {
  createLoginPairing,
  getUserById,
  verifyLogin,
  verifyLoginPairing,
} from '../service/users'
import { getRequestPeer } from '../utils/request-peer'
import {
  broadcastLoginPairingClosed,
  broadcastLoginPairingRequest,
} from '../websocket/login-pairing'

export interface LoginBody {
  userId: number
  password?: string
  pairingId?: string
  code?: string
}

export type LoginOutcome =
  | { kind: 'ok'; token: string }
  | { kind: 'pairing_required'; pairingId: string; expiresAt: number }
  | { kind: 'refused' }

/**
 * Decides a POST /api/auth/login:
 * - an account with a password needs it, from anywhere;
 * - a passwordless account signs in freely on this machine; from the LAN it
 *   needs the pairing code shown in the desktop app. Its first attempt (no
 *   `pairingId`) opens a pairing, the next one sends the code back.
 */
export async function authenticateLogin(
  req: Request,
  body: LoginBody,
): Promise<LoginOutcome> {
  const local = isLocalhost(req)

  let paired = false
  if (body.pairingId && body.code) {
    const { ok, closed } = verifyLoginPairing(
      body.pairingId,
      body.userId,
      body.code,
    )
    if (closed) broadcastLoginPairingClosed(closed.id)
    paired = ok
  }

  const result = await verifyLogin(body.userId, body.password, local || paired)
  if (result) return { kind: 'ok', token: result.token }

  const user = getUserById(body.userId)
  if (local || body.pairingId || !user?.isActive || user.hasPassword) {
    return { kind: 'refused' }
  }
  const pairing = createLoginPairing(
    user.id,
    user.name,
    (getRequestPeer(req) ?? 'unknown').replace(/^::ffff:/, ''),
  )
  if (!pairing) return { kind: 'refused' }
  broadcastLoginPairingRequest(pairing)
  return {
    kind: 'pairing_required',
    pairingId: pairing.id,
    expiresAt: pairing.expiresAt,
  }
}
