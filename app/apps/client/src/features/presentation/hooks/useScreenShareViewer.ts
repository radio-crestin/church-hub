import { useCallback, useEffect, useRef, useState } from 'react'

import { createLogger } from '~/utils/logger'

const logger = createLogger('ScreenShareViewer')

// Optimized WebRTC configuration for local network / low latency reception
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    // STUN servers only needed for NAT traversal, included as fallback
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
  sdpSemantics: 'unified-plan',
  // Prefer UDP for lower latency
  iceTransportPolicy: 'all',
  // Bundle all media over single transport for efficiency
  bundlePolicy: 'max-bundle',
  // Use RTCP mux for lower overhead
  rtcpMuxPolicy: 'require',
}

// Modify SDP for maximum quality reception on local network
function modifySdpForHighQuality(sdp: string): string {
  let modifiedSdp = sdp

  // Remove any existing bandwidth restrictions - local network can handle high bandwidth
  modifiedSdp = modifiedSdp.replace(/b=AS:\d+\r\n/g, '')
  modifiedSdp = modifiedSdp.replace(/b=TIAS:\d+\r\n/g, '')

  // Set very high bandwidth limit (100 Mbps) - matches broadcaster for perfect quality
  const videoMLineRegex = /(m=video \d+ [A-Z/]+ [\d ]+\r\n)/
  if (videoMLineRegex.test(modifiedSdp)) {
    modifiedSdp = modifiedSdp.replace(videoMLineRegex, '$1b=AS:100000\r\n')
  }

  return modifiedSdp
}

export interface ScreenShareViewerState {
  isConnected: boolean
  isConnecting: boolean
  remoteStream: MediaStream | null
  error: string | null
}

interface UseScreenShareViewerProps {
  send: (message: Record<string, unknown>) => Promise<boolean> | boolean
  broadcasterId: string | null
  audioEnabled: boolean
}

export function useScreenShareViewer({
  send,
  broadcasterId,
  audioEnabled,
}: UseScreenShareViewerProps) {
  const [state, setState] = useState<ScreenShareViewerState>({
    isConnected: false,
    isConnecting: false,
    remoteStream: null,
    error: null,
  })

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const iceCandidatesQueueRef = useRef<RTCIceCandidateInit[]>([])

  // Cleanup peer connection
  const cleanup = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    iceCandidatesQueueRef.current = []
    setState({
      isConnected: false,
      isConnecting: false,
      remoteStream: null,
      error: null,
    })
  }, [])

  // Create peer connection for receiving stream
  const createPeerConnection = useCallback(
    (targetBroadcasterId: string) => {
      cleanup()

      const pc = new RTCPeerConnection(RTC_CONFIG)

      pc.ontrack = (event) => {
        logger.debug('Received remote track:', event.track.kind)
        const [remoteStream] = event.streams
        if (remoteStream) {
          // Log the received video resolution
          const videoTrack = remoteStream.getVideoTracks()[0]
          if (videoTrack) {
            const settings = videoTrack.getSettings()
            logger.info(
              `Receiving stream at ${settings.width}x${settings.height} @ ${settings.frameRate}fps`,
            )
          }

          // Configure jitterBufferTarget for minimal latency on local network
          // 50ms is very low - appropriate for local/LAN connections
          // This prioritizes low latency over buffering since local network is stable
          if (event.receiver && 'jitterBufferTarget' in event.receiver) {
            try {
              // @ts-expect-error - jitterBufferTarget is valid but may not be in all TS types
              event.receiver.jitterBufferTarget = 50
              logger.debug('Set jitterBufferTarget to 50ms for low latency')
            } catch (e) {
              logger.warn('Could not set jitterBufferTarget:', e)
            }
          }

          setState((prev) => ({
            ...prev,
            remoteStream,
            isConnected: true,
            isConnecting: false,
          }))
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          send({
            type: 'webrtc_ice_candidate',
            payload: {
              targetClientId: targetBroadcasterId,
              candidate: event.candidate.toJSON(),
            },
          })
        }
      }

      pc.onconnectionstatechange = () => {
        logger.debug(`Connection state with broadcaster: ${pc.connectionState}`)
        if (pc.connectionState === 'connected') {
          // Log codec being used for debugging
          pc.getReceivers().forEach((receiver) => {
            if (receiver.track?.kind === 'video') {
              const params = receiver.getParameters()
              const codec = params.codecs?.[0]
              if (codec) {
                logger.info(`Video codec in use: ${codec.mimeType}`)
              }
            }
          })
          setState((prev) => ({
            ...prev,
            isConnected: true,
            isConnecting: false,
          }))
        } else if (
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          setState((prev) => ({
            ...prev,
            isConnected: false,
            isConnecting: false,
            remoteStream: null,
            error:
              pc.connectionState === 'failed' ? 'Connection failed' : undefined,
          }))
        }
      }

      pc.oniceconnectionstatechange = () => {
        logger.debug(`ICE connection state: ${pc.iceConnectionState}`)
      }

      peerConnectionRef.current = pc
      setState((prev) => ({ ...prev, isConnecting: true }))

      return pc
    },
    [cleanup, send],
  )

  // Handle incoming WebRTC offer
  const handleOffer = useCallback(
    async (offerBroadcasterId: string, sdp: string) => {
      logger.debug('Received offer from broadcaster')

      const pc = createPeerConnection(offerBroadcasterId)

      try {
        await pc.setRemoteDescription({ type: 'offer', sdp })

        // Process queued ICE candidates
        for (const candidate of iceCandidatesQueueRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        }
        iceCandidatesQueueRef.current = []

        const answer = await pc.createAnswer()

        // Modify answer SDP to allow high bandwidth
        const modifiedSdp = modifySdpForHighQuality(answer.sdp || '')
        const modifiedAnswer = {
          type: answer.type,
          sdp: modifiedSdp,
        } as RTCSessionDescriptionInit

        await pc.setLocalDescription(modifiedAnswer)

        send({
          type: 'webrtc_answer',
          payload: {
            targetClientId: offerBroadcasterId,
            sdp: modifiedSdp,
          },
        })

        logger.debug('Sent high-quality answer to broadcaster')
      } catch (error) {
        logger.error('Failed to handle offer:', error)
        cleanup()
        setState((prev) => ({
          ...prev,
          error: 'Failed to connect to screen share',
        }))
      }
    },
    [createPeerConnection, send, cleanup],
  )

  // Handle incoming ICE candidate
  const handleIceCandidate = useCallback(
    async (candidate: RTCIceCandidateInit) => {
      const pc = peerConnectionRef.current
      if (!pc) {
        // Queue candidate if peer connection doesn't exist yet
        iceCandidatesQueueRef.current.push(candidate)
        return
      }

      try {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        } else {
          iceCandidatesQueueRef.current.push(candidate)
        }
      } catch (error) {
        logger.error('Failed to add ICE candidate:', error)
      }
    },
    [],
  )

  // Handle WebSocket message
  const handleWebSocketMessage = useCallback(
    (data: Record<string, unknown>) => {
      const type = data.type as string

      switch (type) {
        case 'webrtc_offer': {
          const payload = data.payload as {
            broadcasterId: string
            sdp: string
          }
          handleOffer(payload.broadcasterId, payload.sdp)
          break
        }

        case 'webrtc_ice_candidate': {
          const payload = data.payload as {
            fromClientId: string
            candidate: RTCIceCandidateInit
          }
          handleIceCandidate(payload.candidate)
          break
        }

        case 'screen_share_stopped': {
          cleanup()
          break
        }
      }
    },
    [handleOffer, handleIceCandidate, cleanup],
  )

  // Request to join screen share when broadcaster ID is available
  useEffect(() => {
    if (broadcasterId && !state.isConnected && !state.isConnecting) {
      logger.debug(`Requesting to join screen share from ${broadcasterId}`)
      send({
        type: 'screen_share_join_request',
        payload: {},
      })
    }
  }, [broadcasterId, state.isConnected, state.isConnecting, send])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    state,
    handleWebSocketMessage,
    cleanup,
    audioEnabled,
  }
}
