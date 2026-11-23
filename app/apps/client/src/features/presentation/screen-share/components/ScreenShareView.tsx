import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Constraint, VideoElementConfig } from '../../types'
import { useGpuShareSurface } from '../hooks/useGpuShareSurface'
import { screenShareStreamUrl } from '../service/screenShareApi'

function toCssEdge(constraint: Constraint): string | undefined {
  return constraint.enabled
    ? `${constraint.value}${constraint.unit}`
    : undefined
}

interface ScreenShareViewProps {
  /** Identifies this share, so a new share opens a new stream. */
  session: number | string
  /** The screen's position, size and fit for the share. */
  videoElement?: VideoElementConfig
  /** A desktop projector window: Rust may draw the share with the GPU. */
  nativeWindow?: boolean
}

/**
 * The shared screen, placed by the screen's settings: drawn by the GPU in a
 * desktop projector window when it can, else the MJPEG stream in an <img>.
 */
export function ScreenShareView({
  session,
  videoElement,
  nativeWindow = false,
}: ScreenShareViewProps) {
  const { t } = useTranslation('presentation')
  const surfaceRef = useRef<HTMLDivElement>(null)
  const objectFit = videoElement?.objectFit ?? 'contain'
  const gpu = useGpuShareSurface(surfaceRef, nativeWindow, objectFit)
  // A dropped stream (server restart, network) reconnects on a new URL.
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState(false)

  const containerStyle = useMemo(() => {
    if (!videoElement) return { inset: 0 }
    const { constraints } = videoElement
    return {
      left: toCssEdge(constraints.left),
      right: toCssEdge(constraints.right),
      top: toCssEdge(constraints.top),
      bottom: toCssEdge(constraints.bottom),
    }
  }, [videoElement])

  const surfaceStyle = videoElement
    ? {
        width: `${videoElement.size.width}${videoElement.size.widthUnit}`,
        height: `${videoElement.size.height}${videoElement.size.heightUnit}`,
      }
    : { width: '100%', height: '100%' }

  return (
    <div
      className="absolute bg-black flex items-center justify-center overflow-hidden"
      style={containerStyle}
      data-testid="screen-share-view"
    >
      <div
        ref={surfaceRef}
        className="relative"
        style={surfaceStyle}
        data-renderer={gpu ? 'gpu' : 'stream'}
      >
        {!gpu && (
          <img
            key={attempt}
            src={`${screenShareStreamUrl(session)}&attempt=${attempt}`}
            alt=""
            className="absolute inset-0 w-full h-full"
            style={{ objectFit }}
            onLoad={() => setLoaded(true)}
            onError={() => {
              setLoaded(false)
              setTimeout(() => setAttempt((n) => n + 1), 1000)
            }}
          />
        )}
        {!gpu && !loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-black text-white/70 text-lg">
            {t('controlRoom.screenShare.waiting')}
          </div>
        )}
      </div>
    </div>
  )
}
