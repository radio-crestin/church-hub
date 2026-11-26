import type { BrowserServer } from '~/features/browser-server'
import { ICE_SERVERS, iceGathered } from '~/features/remote-access'

/** Each device's connection, with its data channels (cut on a revoke). */
export type ScreenPeers = Map<RTCPeerConnection, Set<RTCDataChannel>>

/**
 * Answers a device's WebRTC offer for this phone's room: its data channel
 * becomes a tunnel to the server in this page's worker (a port of its own,
 * as a display window gets), carried through as it is. The device signs in
 * there with its screen link. Returns the SDP answer; `peers` keeps the
 * connection and its channels, to be cut on a revoke.
 */
export async function answerScreenOffer(
  offerSdp: string,
  server: BrowserServer,
  peers: ScreenPeers,
): Promise<string> {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
  const channels = new Set<RTCDataChannel>()
  peers.set(pc, channels)
  pc.ondatachannel = ({ channel }) => {
    channels.add(channel)
    const port = server.openPort()
    port.onmessage = (event: MessageEvent<string>) => {
      if (channel.readyState === 'open') channel.send(event.data)
    }
    channel.onmessage = (event: MessageEvent<string>) =>
      port.postMessage(event.data)
    channel.onclose = () => port.close()
  }
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      peers.delete(pc)
      pc.close()
    }
  }
  await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp })
  await pc.setLocalDescription(await pc.createAnswer())
  await iceGathered(pc)
  const answer = pc.localDescription
  if (!answer) throw new Error('No local description for the screen tunnel')
  return answer.sdp
}
