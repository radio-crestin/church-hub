import { useEffect, useRef } from 'react'

import { useMediaUrl } from '~/features/background-media/hooks/useMediaUrl'
import { createLogger } from '~/utils/logger'

const logger = createLogger('app:screen-video')

interface ScreenVideoProps {
  /** The video's stored URL (`/api/media/backgrounds/<id>`) */
  url: string
  /** Only the main displays play its sound; previews and the others are muted. */
  withSound: boolean
}

/**
 * A presentation's video item, full screen over the background, from its
 * start, once (the presentation moves on when it ends).
 */
export function ScreenVideo({ url, withSound }: ScreenVideoProps) {
  const src = useMediaUrl(url)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return
    video.muted = !withSound
    video.play().catch((error: unknown) => {
      // A browser may refuse sound without a click first: play it muted.
      logger.debug(`Video did not start with sound: ${src}`, error)
      video.muted = true
      video.play().catch((e: unknown) => logger.warn('Video did not start', e))
    })
  }, [src, withSound])

  if (!src) return null
  return (
    <video
      key={src}
      ref={videoRef}
      data-testid="screen-video"
      src={src}
      autoPlay
      playsInline
      preload="auto"
      className="absolute inset-0 h-full w-full bg-black object-contain"
    />
  )
}
