import { ScreenContent, type ScreenContentProps } from './ScreenContent'
import type { ContentData, NextSlideData } from './types'
import type { ShownContent } from '../../hooks/useContentTypeHandoff'
import { slideLayerKey } from '../../utils/slideKind'

interface ScreenContentLayersProps extends ScreenContentProps {
  /** The previous kind of slide, fading out with its own template (useContentTypeHandoff) */
  leaving?: ShownContent<ContentData, NextSlideData | undefined> | null
}

const LAYER_STYLE: React.CSSProperties = { position: 'absolute', inset: 0 }

/**
 * Draws the content and, while a new kind of slide comes (a song, then a
 * verse, or another template), the old one fading out before it, drawn with
 * the template it was shown in. Each kind keeps its own ScreenContent, so the
 * old one plays its exit while the new one waits hidden
 * (useContentTypeHandoff), then enters.
 */
export function ScreenContentLayers({
  leaving,
  ...props
}: ScreenContentLayersProps) {
  return (
    <div
      className="relative"
      style={{ width: props.containerWidth, height: props.containerHeight }}
    >
      {leaving && (
        <div
          key={slideLayerKey(leaving.contentType, leaving.screen)}
          style={LAYER_STYLE}
          aria-hidden="true"
        >
          <ScreenContent
            {...props}
            screen={leaving.screen ?? props.screen}
            contentType={leaving.contentType}
            contentData={leaving.contentData}
            contentKey={leaving.contentKey}
            nextSlideData={leaving.nextSlideData}
            styleRanges={undefined}
            isVisible={false}
            videoSound={false}
          />
        </div>
      )}
      <div
        key={slideLayerKey(props.contentType, props.screen)}
        style={LAYER_STYLE}
      >
        <ScreenContent {...props} />
      </div>
    </div>
  )
}
