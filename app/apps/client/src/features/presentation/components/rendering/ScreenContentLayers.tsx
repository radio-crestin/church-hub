import { ScreenContent, type ScreenContentProps } from './ScreenContent'
import type { ContentData, NextSlideData } from './types'
import type { ShownContent } from '../../hooks/useContentTypeHandoff'
import { contentFamily } from '../../utils/contentFamily'

interface ScreenContentLayersProps extends ScreenContentProps {
  /** The previous content type's content, fading out (usePresentationContent) */
  leaving?: ShownContent<ContentData, NextSlideData | undefined> | null
}

const LAYER_STYLE: React.CSSProperties = { position: 'absolute', inset: 0 }

/**
 * Draws the content and, while the content type changes (a song, then a
 * verse), the old content fading out under it. Each content family keeps its
 * own ScreenContent, so the old one plays its exit as the new one enters.
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
          key={contentFamily(leaving.contentType)}
          style={LAYER_STYLE}
          aria-hidden="true"
        >
          <ScreenContent
            {...props}
            contentType={leaving.contentType}
            contentData={leaving.contentData}
            contentKey={leaving.contentKey}
            nextSlideData={leaving.nextSlideData}
            styleRanges={undefined}
            isVisible={false}
          />
        </div>
      )}
      <div key={contentFamily(props.contentType)} style={LAYER_STYLE}>
        <ScreenContent {...props} />
      </div>
    </div>
  )
}
