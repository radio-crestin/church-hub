import { resolveMediaUrl } from '~/features/background-media/utils/resolveMediaUrl'
import { ScreenBackgroundStill } from './ScreenBackgroundStill'
import { ScreenBackgroundVideo } from './ScreenBackgroundVideo'
import type { ScreenBackgroundConfig } from '../../types'

const LAYER_CLASS = 'absolute inset-0 overflow-hidden pointer-events-none'
const MEDIA_CLASS = 'absolute inset-0'
const DEFAULT_COLOR = '#000000'

interface ScreenBackgroundProps {
  /** undefined falls back to black, as screens always have */
  background: ScreenBackgroundConfig | undefined
  /**
   * false shows a still frame of a video background (thumbnails), drawn from
   * one capture shared by every thumbnail instead of a player each
   */
  playVideo?: boolean
}

/**
 * The background layer of a screen root (projection, previews, editor canvas).
 *
 * Rendered as the root's first child, so the positioned content after it
 * paints on top. Opacity lives on this layer only — it dims the background
 * (an image or video against the base colour), never the text above it.
 */
export function ScreenBackground({
  background,
  playVideo = true,
}: ScreenBackgroundProps) {
  const type = background?.type ?? 'color'
  const opacity = background?.opacity ?? 1

  if (type === 'transparent') return null

  if (type === 'image' || type === 'video') {
    const url = type === 'image' ? background?.imageUrl : background?.videoUrl
    const src = url ? resolveMediaUrl(url) : null

    return (
      <div
        data-testid="screen-background"
        data-background-type={type}
        className={LAYER_CLASS}
        style={{ backgroundColor: background?.color ?? DEFAULT_COLOR }}
      >
        {src && type === 'image' && (
          <div
            data-testid="screen-background-image"
            className={MEDIA_CLASS}
            style={{
              backgroundImage: `url("${src.replace(/"/g, '%22')}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity,
            }}
          />
        )}
        {src &&
          type === 'video' &&
          (playVideo ? (
            <ScreenBackgroundVideo src={src} opacity={opacity} />
          ) : (
            <ScreenBackgroundStill src={src} opacity={opacity} />
          ))}
      </div>
    )
  }

  // 'color', a missing config, or an unknown type: a solid colour (black)
  return (
    <div
      data-testid="screen-background"
      data-background-type="color"
      className={LAYER_CLASS}
      style={{
        backgroundColor:
          (type === 'color' && background?.color) || DEFAULT_COLOR,
        opacity: type === 'color' ? opacity : 1,
      }}
    />
  )
}
