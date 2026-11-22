import { sendToLocalClients } from './index'
import type { LoginPairing } from '../service/users'

/** Shows a pairing code on this machine's desktop app (local sockets only). */
export function broadcastLoginPairingRequest(pairing: LoginPairing) {
  sendToLocalClients(
    JSON.stringify({
      type: 'login_pairing_request',
      payload: {
        id: pairing.id,
        userName: pairing.userName,
        code: pairing.code,
        requesterIp: pairing.requesterIp,
        expiresAt: pairing.expiresAt,
      },
    }),
  )
}

/** Hides a pairing code once it was used, expired or refused. */
export function broadcastLoginPairingClosed(pairingId: string) {
  sendToLocalClients(
    JSON.stringify({
      type: 'login_pairing_closed',
      payload: { id: pairingId },
    }),
  )
}
