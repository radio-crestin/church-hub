import { useEffect, useRef } from 'react'

import { getVideoStill } from '~/features/background-media/utils/getVideoStill'
import { createLogger } from '~/utils/logger'

const logger = createLogger('app:screen-background')

interface ScreenBackgroundStillProps {
  /** Resolved (absolute) video URL */
  src: string
  opacity: number
}

/**
 * A still frame of a video background, for previews that must not play it
 * (slide thumbnails). Drawn from the one capture every thumbnail of the same
 * video shares, instead of a paused `<video>` — a full media player — each.
 * Until the frame arrives the layer's base colour shows through.
 */
export function ScreenBackgroundStill({
  src,
  opacity,
}: ScreenBackgroundStillProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let current = true
    getVideoStill(src).then(
      (still) => {
        const canvas = canvasRef.current
        if (!current || !canvas) return
        canvas.width = still.width
        canvas.height = still.height
        canvas.getContext('2d')?.drawImage(still, 0, 0)
        canvas.dataset.ready = 'true'
      },
      (error: unknown) => {
        logger.warn(`No still frame for the background video ${src}`, error)
      },
    )
    return () => {
      current = false
    }
  }, [src])

  return (
    <canvas
      ref={canvasRef}
      data-testid="screen-background-video-still"
      aria-hidden
      className="absolute inset-0 h-full w-full object-cover"
      style={{ opacity }}
    />
  )
}
