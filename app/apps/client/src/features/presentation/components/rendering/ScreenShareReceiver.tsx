import { useEffect, useMemo, useRef, useState } from 'react'

import { useScreenShareViewer } from '../../hooks/useScreenShareViewer'
import type { VideoElementConfig } from '../../types'

interface ScreenShareReceiverProps {
  broadcasterId: string
  audioEnabled: boolean
  send: (message: Record<string, unknown>) => Promise<boolean> | boolean
  videoElement?: VideoElementConfig
}

export function ScreenShareReceiver({
  broadcasterId,
  audioEnabled,
  send,
  videoElement,
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

  // Calculate container and video styles from videoElement config
  const containerStyle = useMemo(() => {
    if (!videoElement) {
      return { inset: 0 }
    }

    const { constraints } = videoElement
    return {
      left:
        constraints.left !== undefined
          ? `${constraints.left}${constraints.leftUnit}`
          : undefined,
      right:
        constraints.right !== undefined
          ? `${constraints.right}${constraints.rightUnit}`
          : undefined,
      top:
        constraints.top !== undefined
          ? `${constraints.top}${constraints.topUnit}`
          : undefined,
      bottom:
        constraints.bottom !== undefined
          ? `${constraints.bottom}${constraints.bottomUnit}`
          : undefined,
    }
  }, [videoElement])

  const videoStyle = useMemo(() => {
    // Base styles for perfect quality rendering on local network
    const crispRenderingStyles = {
      // Use high-quality rendering (browser will use best available algorithm)
      imageRendering: 'auto' as const,
      // Force hardware acceleration for smooth playback
      transform: 'translateZ(0)',
      willChange: 'transform',
      // Ensure color accuracy
      colorRendering: 'optimizeQuality',
      // Prevent any browser optimizations that could reduce quality
      backfaceVisibility: 'hidden' as const,
    }

    if (!videoElement) {
      return {
        ...crispRenderingStyles,
        width: '100%',
        height: '100%',
        objectFit: 'contain' as const,
      }
    }

    const { size, objectFit } = videoElement
    return {
      ...crispRenderingStyles,
      width: `${size.width}${size.widthUnit}`,
      height: `${size.height}${size.heightUnit}`,
      objectFit: objectFit,
    }
  }, [videoElement])

  return (
    <div
      className="absolute bg-black flex items-center justify-center overflow-hidden"
      style={containerStyle}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={!audioEnabled}
        style={videoStyle}
        onLoadedMetadata={() => setIsVideoReady(true)}
        // Disable picture-in-picture to prevent quality reduction from PiP optimization
        disablePictureInPicture
        // Disable remote playback (casting) to maintain quality
        disableRemotePlayback
        // Prefer native controls disabled for full quality
        controls={false}
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
