import { useEffect, useRef, useState } from 'react'

import { MediaUnavailable } from '~/features/background-media/components/MediaUnavailable'
import { createLogger } from '~/utils/logger'
import { useDeckMedia } from '../hooks/useDeckMedia'

const logger = createLogger('app:slides-deck:video')

interface DeckVideoProps {
  mediaId: string
  posterMediaId?: string
  /** Plays as the slide shows it; else it waits on its first frame. */
  play: boolean
  loop: boolean
  /** Only the main displays play its sound, at `volume`. */
  withSound: boolean
  volume?: number
  fit: 'cover' | 'contain' | 'fill'
}

/**
 * A video on a deck slide (an element or the background). A browser that
 * refuses sound without a click plays it muted, like ScreenVideo.
 */
export function DeckVideo({
  mediaId,
  posterMediaId,
  play,
  loop,
  withSound,
  volume,
  fit,
}: DeckVideoProps) {
  const { src, unavailable } = useDeckMedia(mediaId)
  const poster = useDeckMedia(posterMediaId).src
  const [failed, setFailed] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src || !play) return
    video.muted = !withSound
    if (volume !== undefined) video.volume = volume
    video.play().catch((error: unknown) => {
      logger.debug(`Deck video did not start with sound: ${src}`, error)
      video.muted = true
      video
        .play()
        .catch((e: unknown) => logger.warn('Deck video did not start', e))
    })
  }, [src, play, withSound, volume])

  if (unavailable || (src && failed === src)) {
    return (
      <div className="relative h-full w-full">
        <MediaUnavailable kind="video" />
      </div>
    )
  }
  if (!src) return null
  return (
    <video
      ref={videoRef}
      onError={() => setFailed(src)}
      data-testid="deck-video"
      src={src}
      poster={poster ?? undefined}
      muted
      loop={loop}
      playsInline
      preload={play ? 'auto' : 'metadata'}
      className="block h-full w-full"
      style={{ objectFit: fit }}
    />
  )
}
