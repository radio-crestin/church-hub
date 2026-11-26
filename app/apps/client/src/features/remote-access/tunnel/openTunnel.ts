import { createTunnel, type Tunnel } from './createTunnel'
import { iceGathered } from './iceGathered'
import { ICE_SERVERS } from './iceServers'
import { relayFetch } from './relayFetch'
import type { RemotePairing } from '../service/remotePairing'

/** The computer polls the relay every 2 s; this covers a slow answer. */
const ANSWER_MS = 20_000
const ANSWER_POLL_MS = 300
const OPEN_MS = 15_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function channelOpen(channel: RTCDataChannel) {
  return new Promise<void>((resolve, reject) => {
    if (channel.readyState === 'open') return resolve()
    channel.addEventListener('open', () => resolve())
    setTimeout(() => reject(new Error('The computer did not connect')), OPEN_MS)
  })
}

async function waitForAnswer(
  { relay, secret }: RemotePairing,
  sessionId: string,
): Promise<string> {
  const deadline = Date.now() + ANSWER_MS
  while (Date.now() < deadline) {
    const res = await relayFetch(
      `${relay}/signal/${secret}/answer/${sessionId}`,
    )
    const data = (await res.json()) as { answer?: string }
    if (data.answer) return data.answer
    await sleep(ANSWER_POLL_MS)
  }
  throw new Error('The computer did not answer')
}

/**
 * Connects to the computer over WebRTC through the signaling relay; throws
 * when the computer isn't there (remote access off, or the computer off).
 */
export async function openTunnel(pairing: RemotePairing): Promise<Tunnel> {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
  const channel = pc.createDataChannel('church-hub')
  try {
    await pc.setLocalDescription(await pc.createOffer())
    await iceGathered(pc)
    const res = await relayFetch(
      `${pairing.relay}/signal/${pairing.secret}/offer`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer: pc.localDescription?.sdp }),
      },
    )
    if (!res.ok) throw new Error(`The relay refused the offer (${res.status})`)
    const { sessionId } = (await res.json()) as { sessionId: string }
    const answer = await waitForAnswer(pairing, sessionId)
    await pc.setRemoteDescription({ type: 'answer', sdp: answer })
    await channelOpen(channel)
  } catch (error) {
    pc.close()
    throw error
  }
  const tunnel = createTunnel(channel)
  tunnel.onClose(() => pc.close())
  // A computer switched off or gone from the network closes nothing: its
  // connection fails once it stops answering.
  pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState === 'failed') tunnel.close()
  })
  return tunnel
}
