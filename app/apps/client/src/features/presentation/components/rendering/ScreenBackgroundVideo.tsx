import { useEffect, useRef } from 'react'

import { createLogger } from '~/utils/logger'

const logger = createLogger('app:screen-background')

interface ScreenBackgroundVideoProps {
  /** Resolved (absolute) video URL */
  src: string
  opacity: number
  /** false shows a still first frame instead of playing (thumbnails) */
  playVideo: boolean
}

/**
 * The looping, muted video behind a screen's text. Keyed by `src` alone, so it
 * keeps playing across slide changes and across content types (song, first and
 * last slide) that share the same video.
 */
export function ScreenBackgroundVideo({
  src,
  opacity,
  playVideo,
}: ScreenBackgroundVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // React's `muted` prop is not reflected as an attribute before autoplay is
  // evaluated, so the autoplay policy can still block playback: mute the
  // element itself and start it explicitly.
  useEffect(() => {
    const video = videoRef.current
    if (!video || !playVideo) return
    video.muted = true
    video.defaultMuted = true
    video.play().catch((error: unknown) => {
      logger.debug(`Background video did not start: ${src}`, error)
    })
  }, [src, playVideo])

  return (
    <video
      key={src}
      ref={videoRef}
      data-testid="screen-background-video"
      // A media fragment makes the still variant paint its first frame.
      src={playVideo ? src : `${src}#t=0.1`}
      autoPlay={playVideo}
      loop={playVideo}
      muted
      playsInline
      preload={playVideo ? 'auto' : 'metadata'}
      aria-hidden
      className="absolute inset-0 h-full w-full object-cover"
      style={{ opacity }}
    />
  )
}
