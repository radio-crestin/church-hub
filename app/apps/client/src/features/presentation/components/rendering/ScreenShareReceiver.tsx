import { useEffect, useRef, useState } from 'react'

import { useScreenShareViewer } from '../../hooks/useScreenShareViewer'

interface ScreenShareReceiverProps {
  broadcasterId: string
  audioEnabled: boolean
  send: (message: Record<string, unknown>) => Promise<boolean> | boolean
}

export function ScreenShareReceiver({
  broadcasterId,
  audioEnabled,
  send,
}: ScreenShareReceiverProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isVideoReady, setIsVideoReady] = useState(false)

  const { state, handleWebSocketMessage } = useScreenShareViewer({
    send,
    broadcasterId,
    audioEnabled,
  })

  // Subscribe to WebSocket messages via custom events
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

  // Attach remote stream to video element
  useEffect(() => {
    if (videoRef.current && state.remoteStream) {
      videoRef.current.srcObject = state.remoteStream
      setIsVideoReady(true)
    } else {
      setIsVideoReady(false)
    }
  }, [state.remoteStream])

  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={!audioEnabled}
        className="w-full h-full object-contain"
        onLoadedMetadata={() => setIsVideoReady(true)}
      />
      {!isVideoReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            <div className="text-white text-lg">
              {state.isConnecting
                ? 'Connecting to screen share...'
                : state.error || 'Waiting for stream...'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
