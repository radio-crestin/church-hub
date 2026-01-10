import { useCallback, useEffect, useRef, useState } from 'react'

import { createLogger } from '~/utils/logger'

const logger = createLogger('ScreenShareViewer')

// Low-latency WebRTC configuration with Google STUN servers
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
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
        await pc.setLocalDescription(answer)

        send({
          type: 'webrtc_answer',
          payload: {
            targetClientId: offerBroadcasterId,
            sdp: answer.sdp,
          },
        })

        logger.debug('Sent answer to broadcaster')
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
