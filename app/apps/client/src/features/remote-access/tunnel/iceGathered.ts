/** STUN candidates come in well under this; past it the SDP goes as is. */
const GATHER_MS = 1500

/** Resolves once the connection gathered its ICE candidates (or after 1.5 s). */
export function iceGathered(pc: RTCPeerConnection) {
  return new Promise<void>((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve()
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') resolve()
    })
    setTimeout(resolve, GATHER_MS)
  })
}
