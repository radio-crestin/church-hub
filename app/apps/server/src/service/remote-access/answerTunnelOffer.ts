import { RTCPeerConnection } from 'werift'

import { remoteAccessTarget } from './remoteAccessTarget'
import { createTunnelSession } from './tunnelSession'
import { log } from '../../utils/fileLogger'
import { ICE_SERVERS } from '../signaling/iceServers'

const logger = {
  info: (msg: string, data?: unknown) =>
    log('remote-access', 'info', msg, data),
  warn: (msg: string, data?: unknown) =>
    log('remote-access', 'warn', msg, data),
}

const peers = new Set<RTCPeerConnection>()

/** ICE gathering rarely takes longer; past it the partial answer still works. */
const GATHER_MS = 2500

/**
 * Answers a phone's WebRTC offer: its data channel becomes a tunnel to this
 * server (createTunnelSession). Returns the SDP answer.
 */
export async function answerTunnelOffer(offerSdp: string): Promise<string> {
  const pc = new RTCPeerConnection({
    iceServers: ICE_SERVERS,
    bundlePolicy: 'max-bundle',
  })
  peers.add(pc)

  pc.onDataChannel.subscribe((channel) => {
    const session = createTunnelSession((text) => {
      if (channel.readyState === 'open') channel.send(text)
    }, remoteAccessTarget())
    logger.info('Phone connected over the tunnel')
    channel.onMessage.subscribe((data) => {
      const text =
        typeof data === 'string' ? data : Buffer.from(data).toString('utf-8')
      try {
        session.receive(text)
      } catch (error) {
        logger.warn('Unreadable tunnel message', { error: String(error) })
      }
    })
    channel.stateChange.subscribe((state) => {
      if (state === 'closed') session.close()
    })
  })

  pc.connectionStateChange.subscribe((state) => {
    if (state === 'failed' || state === 'closed') {
      peers.delete(pc)
      logger.info('Phone tunnel closed', { state })
    }
  })

  await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp })
  await pc.setLocalDescription(await pc.createAnswer())
  if (pc.iceGatheringState !== 'complete') {
    await pc.iceGatheringStateChange.watch(
      (state) => state === 'complete',
      GATHER_MS,
    )
  }
  const answer = pc.localDescription
  if (!answer) throw new Error('No local description for the phone tunnel')
  return answer.sdp
}

/** Disconnects every phone (remote access turned off). */
export function closeTunnels() {
  for (const pc of peers) pc.close()
  peers.clear()
}
