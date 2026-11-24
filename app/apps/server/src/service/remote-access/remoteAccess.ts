import { answerTunnelOffer, closeTunnels } from './answerTunnelOffer'
import { getRemoteAccessSettings } from './remoteAccessSettings'
import { startSignalingRelay } from '../signaling/startSignalingRelay'

/** A phone away from the church waits at most this long to be answered. */
const POLL_MS = 2000

let closeRoom: (() => Promise<void>) | null = null

/**
 * Opens or closes this computer's room on the signaling relay to match the
 * setting: while open, paired phones reach it over WebRTC from anywhere.
 */
export async function applyRemoteAccess() {
  const { enabled, secret } = getRemoteAccessSettings()
  if (closeRoom) {
    await closeRoom()
    closeRoom = null
    closeTunnels()
  }
  if (!enabled) return
  closeRoom = startSignalingRelay({
    secret,
    pollMs: POLL_MS,
    answer: answerTunnelOffer,
  })
}
