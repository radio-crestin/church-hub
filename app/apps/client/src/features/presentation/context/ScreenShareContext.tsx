import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { createLogger } from '~/utils/logger'

const logger = createLogger('ScreenShare')

// Optimized WebRTC configuration for local network / high quality streaming
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    // STUN servers only needed for NAT traversal, but included as fallback
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
  // Prefer UDP for lower latency (default, but explicit)
  iceTransportPolicy: 'all',
  // Bundle all media over single transport for efficiency
  bundlePolicy: 'max-bundle',
  // Use RTCP mux for lower overhead
  rtcpMuxPolicy: 'require',
}

// Modify SDP for maximum quality on local network
function modifySdpForHighQuality(sdp: string): string {
  let modifiedSdp = sdp

  // Remove any existing bandwidth restrictions - local network can handle high bandwidth
  modifiedSdp = modifiedSdp.replace(/b=AS:\d+\r\n/g, '')
  modifiedSdp = modifiedSdp.replace(/b=TIAS:\d+\r\n/g, '')

  // Set very high bandwidth limit (100 Mbps) for local network
  // This ensures no compression artifacts on local/LAN connections
  const videoMLineRegex = /(m=video \d+ [A-Z/]+ [\d ]+\r\n)/
  if (videoMLineRegex.test(modifiedSdp)) {
    modifiedSdp = modifiedSdp.replace(videoMLineRegex, '$1b=AS:100000\r\n')
  }

  return modifiedSdp
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

interface ScreenShareContextValue {
  state: ScreenShareState
  startScreenShare: (options?: { audio?: boolean }) => Promise<void>
  stopScreenShare: () => void
  handleWebSocketMessage: (data: Record<string, unknown>) => void
  getMediaStream: () => MediaStream | null
  setClientId: (id: string) => void
  setSend: (
    sendFn: (message: Record<string, unknown>) => Promise<boolean> | boolean,
  ) => void
}

const ScreenShareContext = createContext<ScreenShareContextValue | null>(null)

export function ScreenShareProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [state, setState] = useState<ScreenShareState>({
    isActive: false,
    isSharing: false,
    audioEnabled: false,
    broadcasterId: null,
    error: null,
  })

  // Store clientId and send function in refs so they can be updated
  const clientIdRef = useRef<string | null>(null)
  const sendRef = useRef<
    ((message: Record<string, unknown>) => Promise<boolean> | boolean) | null
  >(null)

  // Track peer connections (broadcaster has multiple, viewer has one)
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map())
  const mediaStreamRef = useRef<MediaStream | null>(null)

  const setClientId = useCallback((id: string) => {
    clientIdRef.current = id
  }, [])

  const setSend = useCallback(
    (
      sendFn: (message: Record<string, unknown>) => Promise<boolean> | boolean,
    ) => {
      sendRef.current = sendFn
    },
    [],
  )

  // Helper to send messages
  const send = useCallback((message: Record<string, unknown>) => {
    if (sendRef.current) {
      return sendRef.current(message)
    }
    return false
  }, [])

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

      // Configure for perfect quality on local network
      pc.getTransceivers().forEach((transceiver) => {
        if (transceiver.sender.track?.kind === 'video') {
          const params = transceiver.sender.getParameters()
          if (params.encodings && params.encodings.length > 0) {
            // Very high bitrate for perfect quality on local network (100 Mbps)
            params.encodings[0].maxBitrate = 100000000
            params.encodings[0].maxFramerate = 60
            params.encodings[0].scaleResolutionDownBy = 1.0
            // @ts-expect-error - degradationPreference is valid but not in TS types
            params.encodings[0].degradationPreference = 'maintain-resolution'
            params.encodings[0].priority = 'high'
            params.encodings[0].networkPriority = 'high'
            transceiver.sender.setParameters(params).catch(logger.error)
          }

          // Prefer VP9 for screen sharing
          const codecs = RTCRtpSender.getCapabilities?.('video')?.codecs
          if (codecs) {
            const codecsCopy = [...codecs]
            const vp9 = codecsCopy.filter((c) => c.mimeType === 'video/VP9')
            const av1 = codecsCopy.filter((c) => c.mimeType === 'video/AV1')
            const h264 = codecsCopy.filter((c) => c.mimeType === 'video/H264')
            const vp8 = codecsCopy.filter((c) => c.mimeType === 'video/VP8')
            const others = codecsCopy.filter(
              (c) =>
                c.mimeType !== 'video/VP9' &&
                c.mimeType !== 'video/AV1' &&
                c.mimeType !== 'video/H264' &&
                c.mimeType !== 'video/VP8',
            )
            const orderedCodecs = [...vp9, ...av1, ...h264, ...vp8, ...others]
            if (orderedCodecs.length > 0) {
              transceiver.setCodecPreferences?.(orderedCodecs)
            }
          }
        }
        if (transceiver.sender.track?.kind === 'audio') {
          const params = transceiver.sender.getParameters()
          if (params.encodings && params.encodings.length > 0) {
            params.encodings[0].maxBitrate = 256000
            params.encodings[0].priority = 'high'
            params.encodings[0].networkPriority = 'high'
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
        logger.info(`Connection state for ${viewerId}: ${pc.connectionState}`)
        if (pc.connectionState === 'connected') {
          pc.getSenders().forEach((sender) => {
            if (sender.track?.kind === 'video') {
              const params = sender.getParameters()
              const codec = params.codecs?.[0]
              if (codec) {
                logger.info(
                  `Video codec in use for ${viewerId}: ${codec.mimeType}`,
                )
              }
            }
          })
        } else if (
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          logger.warn(
            `Peer connection ${pc.connectionState} for ${viewerId} - cleaning up`,
          )
          cleanupPeerConnection(viewerId)
        }
      }

      pc.oniceconnectionstatechange = () => {
        logger.info(
          `ICE connection state for ${viewerId}: ${pc.iceConnectionState}`,
        )
        if (pc.iceConnectionState === 'failed') {
          logger.error(
            `ICE connection failed for ${viewerId} - attempting restart`,
          )
          pc.restartIce()
        }
      }

      pc.onicegatheringstatechange = () => {
        logger.debug(
          `ICE gathering state for ${viewerId}: ${pc.iceGatheringState}`,
        )
      }

      peerConnectionsRef.current.set(viewerId, {
        clientId: viewerId,
        pc,
        iceCandidatesQueue,
      })

      // Create and send offer with high-quality SDP
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: false,
        })

        const modifiedSdp = modifySdpForHighQuality(offer.sdp || '')
        const modifiedOffer = {
          type: offer.type,
          sdp: modifiedSdp,
        } as RTCSessionDescriptionInit

        await pc.setLocalDescription(modifiedOffer)

        send({
          type: 'webrtc_offer',
          payload: {
            targetClientId: viewerId,
            sdp: modifiedSdp,
          },
        })

        logger.debug(`Sent high-quality offer to ${viewerId}`)
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
    const stack = new Error().stack
    logger.info(`Screen share stop triggered. Call stack:\n${stack}`)

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

        // Request screen capture with highest resolution
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 3840, max: 3840 },
            height: { ideal: 2160, max: 2160 },
            frameRate: { ideal: 60, max: 60 },
            displaySurface: 'monitor',
            cursor: 'always',
          },
          audio: audioEnabled
            ? {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                sampleRate: 48000,
                channelCount: 2,
              }
            : false,
          preferCurrentTab: false,
          selfBrowserSurface: 'exclude',
        } as DisplayMediaStreamOptions)

        // Get the video track and configure for maximum quality
        const videoTrack = stream.getVideoTracks()[0]
        if (videoTrack) {
          if ('contentHint' in videoTrack) {
            videoTrack.contentHint = 'text'
          }

          const settings = videoTrack.getSettings()
          logger.info(
            `Screen capture started at ${settings.width}x${settings.height} @ ${settings.frameRate}fps`,
          )

          try {
            await videoTrack.applyConstraints({
              width: { ideal: settings.width },
              height: { ideal: settings.height },
              frameRate: { ideal: 60, max: 60 },
            })
          } catch (constraintError) {
            logger.warn('Could not apply track constraints:', constraintError)
          }
        }

        mediaStreamRef.current = stream

        // Handle stream ending
        const videoTrackForEvents = stream.getVideoTracks()[0]
        if (videoTrackForEvents) {
          videoTrackForEvents.onended = () => {
            logger.info(
              `Video track ended - readyState: ${videoTrackForEvents.readyState}, muted: ${videoTrackForEvents.muted}`,
            )
            stopScreenShareRef.current()
          }

          videoTrackForEvents.onmute = () => {
            logger.warn('Video track muted - this may indicate a capture issue')
          }
          videoTrackForEvents.onunmute = () => {
            logger.debug('Video track unmuted')
          }
        }

        const currentClientId = clientIdRef.current

        setState((prev) => ({
          ...prev,
          isSharing: true,
          isActive: true,
          audioEnabled,
          broadcasterId: currentClientId,
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
    [send],
  )

  // Handle WebSocket message
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
          }))
          break
        }

        case 'screen_share_stopped': {
          stopMediaStream()
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

  // Listen for screen share WebSocket messages (persists across page navigations)
  useEffect(() => {
    const handleMessage = (event: CustomEvent) => {
      handleWebSocketMessage(event.detail)
    }

    window.addEventListener(
      'screen-share-message',
      handleMessage as EventListener,
    )
    return () => {
      window.removeEventListener(
        'screen-share-message',
        handleMessage as EventListener,
      )
    }
  }, [handleWebSocketMessage])

  // Cleanup on unmount (app closing)
  useEffect(() => {
    return () => {
      stopMediaStream()
      cleanupAllConnections()
    }
  }, [stopMediaStream, cleanupAllConnections])

  const value = useMemo(
    () => ({
      state,
      startScreenShare,
      stopScreenShare,
      handleWebSocketMessage,
      getMediaStream,
      setClientId,
      setSend,
    }),
    [
      state,
      startScreenShare,
      stopScreenShare,
      handleWebSocketMessage,
      getMediaStream,
      setClientId,
      setSend,
    ],
  )

  return (
    <ScreenShareContext.Provider value={value}>
      {children}
    </ScreenShareContext.Provider>
  )
}

export function useScreenShareContext() {
  const context = useContext(ScreenShareContext)
  if (!context) {
    throw new Error(
      'useScreenShareContext must be used within a ScreenShareProvider',
    )
  }
  return context
}
