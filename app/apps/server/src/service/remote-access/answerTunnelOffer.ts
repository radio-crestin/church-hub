import { type RTCDataChannel, RTCPeerConnection } from 'werift'

import { createTunnelSession } from './tunnelSession'
import { log } from '../../utils/fileLogger'
import { ICE_SERVERS } from '../signaling/iceServers'

const logger = {
  info: (msg: string, data?: unknown) =>
    log('remote-access', 'info', msg, data),
  warn: (msg: string, data?: unknown) =>
    log('remote-access', 'warn', msg, data),
}

/** Each phone's connection, with its data channels. */
const peers = new Map<RTCPeerConnection, Set<RTCDataChannel>>()

/** ICE gathering rarely takes longer; past it the partial answer still works. */
const GATHER_MS = 2500
/** Lets the channels' close reach the phones before the connections go. */
const CLOSE_GRACE_MS = 1000

/**
 * Answers a phone's WebRTC offer: its data channel becomes a tunnel to this
 * server (createTunnelSession). Returns the SDP answer.
 */
export async function answerTunnelOffer(offerSdp: string): Promise<string> {
  const pc = new RTCPeerConnection({
    iceServers: ICE_SERVERS,
    bundlePolicy: 'max-bundle',
  })
  const channels = new Set<RTCDataChannel>()
  peers.set(pc, channels)

  pc.onDataChannel.subscribe((channel) => {
    channels.add(channel)
    const session = createTunnelSession((text) => {
      if (channel.readyState === 'open') channel.send(text)
    })
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

/**
 * Disconnects every phone (remote access turned off). Closing its channels
 * first tells the phone at once; the connection alone would only time out.
 */
export function closeTunnels() {
  for (const [pc, channels] of peers) {
    for (const channel of channels) channel.close()
    setTimeout(() => void pc.close(), CLOSE_GRACE_MS)
  }
  peers.clear()
}
