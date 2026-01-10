import { useCallback, useEffect, useRef, useState } from 'react'

import { createLogger } from '~/utils/logger'

const logger = createLogger('ScreenShare')

// Low-latency WebRTC configuration with Google STUN servers
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
}

export interface ScreenShareState {
  isActive: boolean
  isSharing: boolean // true if THIS client is broadcasting
  audioEnabled: boolean
  broadcasterId: string | null
  error: string | null
}

interface PeerConnection {
  clientId: string
  pc: RTCPeerConnection
  iceCandidatesQueue: RTCIceCandidateInit[]
}

interface UseScreenShareProps {
  send: (message: Record<string, unknown>) => Promise<boolean> | boolean
  clientId: string | null
}

export function useScreenShare({ send, clientId }: UseScreenShareProps) {
  const [state, setState] = useState<ScreenShareState>({
    isActive: false,
    isSharing: false,
    audioEnabled: false,
    broadcasterId: null,
    error: null,
  })

  // Track peer connections (broadcaster has multiple, viewer has one)
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map())
  const mediaStreamRef = useRef<MediaStream | null>(null)

  // Cleanup peer connection
  const cleanupPeerConnection = useCallback((targetClientId: string) => {
    const peer = peerConnectionsRef.current.get(targetClientId)
    if (peer) {
      peer.pc.close()
      peerConnectionsRef.current.delete(targetClientId)
      logger.debug(`Cleaned up peer connection for ${targetClientId}`)
    }
  }, [])

  // Cleanup all peer connections
  const cleanupAllConnections = useCallback(() => {
    for (const [targetClientId] of peerConnectionsRef.current) {
      cleanupPeerConnection(targetClientId)
    }
    peerConnectionsRef.current.clear()
  }, [cleanupPeerConnection])

  // Stop local media stream
  const stopMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
  }, [])

  // Create peer connection for a viewer (broadcaster side)
  const createPeerConnectionForViewer = useCallback(
    async (viewerId: string) => {
      if (!mediaStreamRef.current) return

      const pc = new RTCPeerConnection(RTC_CONFIG)
      const iceCandidatesQueue: RTCIceCandidateInit[] = []

      // Add tracks from local stream
      mediaStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, mediaStreamRef.current!)
      })

      // Configure for low latency
      pc.getTransceivers().forEach((transceiver) => {
        if (transceiver.sender.track?.kind === 'video') {
          const params = transceiver.sender.getParameters()
          if (params.encodings && params.encodings.length > 0) {
            params.encodings[0].maxBitrate = 6000000 // 6 Mbps
            params.encodings[0].maxFramerate = 60
            transceiver.sender.setParameters(params).catch(logger.error)
          }
        }
      })

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          send({
            type: 'webrtc_ice_candidate',
            payload: {
              targetClientId: viewerId,
              candidate: event.candidate.toJSON(),
            },
          })
        }
      }

      pc.onconnectionstatechange = () => {
        logger.debug(`Connection state for ${viewerId}: ${pc.connectionState}`)
        if (
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          cleanupPeerConnection(viewerId)
        }
      }

      peerConnectionsRef.current.set(viewerId, {
        clientId: viewerId,
        pc,
        iceCandidatesQueue,
      })

      // Create and send offer
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: false,
        })

        await pc.setLocalDescription(offer)

        send({
          type: 'webrtc_offer',
          payload: {
            targetClientId: viewerId,
            sdp: offer.sdp,
          },
        })

        logger.debug(`Sent offer to ${viewerId}`)
      } catch (error) {
        logger.error(`Failed to create offer for ${viewerId}:`, error)
        cleanupPeerConnection(viewerId)
      }
    },
    [send, cleanupPeerConnection],
  )

  // Handle incoming WebRTC answer (broadcaster side)
  const handleAnswer = useCallback(async (viewerId: string, sdp: string) => {
    logger.debug(`Received answer from ${viewerId}`)

    const peer = peerConnectionsRef.current.get(viewerId)
    if (!peer) return

    try {
      await peer.pc.setRemoteDescription({ type: 'answer', sdp })

      // Process queued ICE candidates
      for (const candidate of peer.iceCandidatesQueue) {
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate))
      }
      peer.iceCandidatesQueue = []
    } catch (error) {
      logger.error(`Failed to handle answer from ${viewerId}:`, error)
    }
  }, [])

  // Handle incoming ICE candidate
  const handleIceCandidate = useCallback(
    async (fromClientId: string, candidate: RTCIceCandidateInit) => {
      const peer = peerConnectionsRef.current.get(fromClientId)
      if (!peer) {
        logger.debug(
          `No peer connection for ICE candidate from ${fromClientId}`,
        )
        return
      }

      try {
        if (peer.pc.remoteDescription) {
          await peer.pc.addIceCandidate(new RTCIceCandidate(candidate))
        } else {
          peer.iceCandidatesQueue.push(candidate)
        }
      } catch (error) {
        logger.error(`Failed to add ICE candidate from ${fromClientId}:`, error)
      }
    },
    [],
  )

  // Stop screen share (broadcaster)
  const stopScreenShare = useCallback(() => {
    stopMediaStream()
    cleanupAllConnections()

    setState((prev) => ({
      ...prev,
      isSharing: false,
      isActive: false,
      audioEnabled: false,
      broadcasterId: null,
    }))

    send({ type: 'screen_share_stop' })

    logger.info('Screen share stopped')
  }, [stopMediaStream, cleanupAllConnections, send])

  // Ref to stopScreenShare to avoid circular dependency
  const stopScreenShareRef = useRef(stopScreenShare)
  stopScreenShareRef.current = stopScreenShare

  // Start screen share (broadcaster)
  const startScreenShare = useCallback(
    async (options: { audio?: boolean } = {}) => {
      try {
        const audioEnabled = options.audio ?? false

        // Request screen capture
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 60, max: 60 },
          },
          audio: audioEnabled
            ? {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              }
            : false,
        })

        mediaStreamRef.current = stream

        // Handle stream ending (user clicks "Stop sharing")
        stream.getVideoTracks()[0].onended = () => {
          stopScreenShareRef.current()
        }

        setState((prev) => ({
          ...prev,
          isSharing: true,
          isActive: true,
          audioEnabled,
          broadcasterId: clientId,
          error: null,
        }))

        // Notify server
        send({
          type: 'screen_share_start',
          payload: { audioEnabled },
        })

        logger.info('Screen share started')
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to start screen share'
        logger.error('Failed to start screen share:', error)
        setState((prev) => ({ ...prev, error: errorMessage }))
      }
    },
    [send, clientId],
  )

  // Handle WebSocket message (called from parent component)
  const handleWebSocketMessage = useCallback(
    (data: Record<string, unknown>) => {
      const type = data.type as string

      switch (type) {
        case 'screen_share_started': {
          const payload = data.payload as {
            broadcasterId: string
            audioEnabled: boolean
          }
          setState((prev) => ({
            ...prev,
            isActive: true,
            broadcasterId: payload.broadcasterId,
            audioEnabled: payload.audioEnabled,
            // Don't override isSharing if we're the broadcaster
            isSharing:
              payload.broadcasterId === clientId ? prev.isSharing : false,
          }))
          break
        }

        case 'screen_share_stopped': {
          cleanupAllConnections()
          setState((prev) => ({
            ...prev,
            isActive: false,
            isSharing: false,
            broadcasterId: null,
          }))
          break
        }

        case 'screen_share_join_request': {
          const payload = data.payload as { viewerId: string }
          // Broadcaster creates offer for new viewer
          if (state.isSharing && mediaStreamRef.current) {
            createPeerConnectionForViewer(payload.viewerId)
          }
          break
        }

        case 'webrtc_answer': {
          const payload = data.payload as { viewerId: string; sdp: string }
          handleAnswer(payload.viewerId, payload.sdp)
          break
        }

        case 'webrtc_ice_candidate': {
          const payload = data.payload as {
            fromClientId: string
            candidate: RTCIceCandidateInit
          }
          handleIceCandidate(payload.fromClientId, payload.candidate)
          break
        }
      }
    },
    [
      clientId,
      state.isSharing,
      createPeerConnectionForViewer,
      handleAnswer,
      handleIceCandidate,
      cleanupAllConnections,
    ],
  )

  // Get local media stream (for preview)
  const getMediaStream = useCallback(() => {
    return mediaStreamRef.current
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMediaStream()
      cleanupAllConnections()
    }
  }, [stopMediaStream, cleanupAllConnections])

  return {
    state,
    startScreenShare,
    stopScreenShare,
    handleWebSocketMessage,
    getMediaStream,
  }
}
