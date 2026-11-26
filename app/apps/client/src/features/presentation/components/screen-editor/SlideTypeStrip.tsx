import { useTranslation } from 'react-i18next'

import { sampleContentData } from './sampleContent'
import type { ContentType, ScreenWithConfigs } from '../../types'
import { ScreenPreview } from '../ScreenPreview'

/** Every slide type a theme designs, in the order a service meets them. */
export const SLIDE_TYPES: ContentType[] = [
  'song',
  'song_first_slide',
  'song_last_slide',
  'bible',
  'bible_passage',
  'versete_tineri',
  'announcement',
  'empty',
  'screen_share',
]

interface SlideTypeStripProps {
  screen: ScreenWithConfigs
  selected?: ContentType
  /** Without it the strip only shows the slides (a display's settings). */
  onSelect?: (contentType: ContentType) => void
  /** A row that scrolls sideways instead of a column (a settings page). */
  horizontal?: boolean
  /** Names each slide for tests: `<prefix>-<slide type>`. */
  testIdPrefix?: string
}

/**
 * A theme as a presentation: one slide per slide type, each drawn with the
 * theme and a sample, like PowerPoint's slide list. A click opens a slide.
 */
export function SlideTypeStrip({
  screen,
  selected,
  onSelect,
  horizontal = false,
  testIdPrefix = 'screen-editor-slide',
}: SlideTypeStripProps) {
  const { t } = useTranslation('presentation')

  return (
    <div
      data-testid="slide-type-strip"
      className={
        horizontal
          ? 'flex gap-3 overflow-x-auto pb-2'
          : 'flex gap-3 overflow-x-auto p-2 md:w-48 md:flex-col md:overflow-x-hidden md:overflow-y-auto md:border-r border-b md:border-b-0 border-line bg-panel shrink-0'
      }
    >
      {SLIDE_TYPES.map((contentType, index) => {
        const isSelected = contentType === selected
        const label = t(`screens.contentTypes.${contentType}`)
        const body = (
          <>
            <span
              className="relative block w-full overflow-hidden rounded bg-black"
              style={{ aspectRatio: `${screen.width} / ${screen.height}` }}
            >
              <ScreenPreview
                screen={screen}
                contentType={contentType}
                contentData={sampleContentData(contentType)}
                contentKey={`strip-${contentType}`}
                playVideo={false}
              />
            </span>
            <span className="mt-1 flex items-baseline gap-1.5 text-xs">
              <span className="text-fg-hint tabular-nums">{index + 1}</span>
              <span className="truncate font-medium text-fg-body">{label}</span>
            </span>
          </>
        )
        const className = `block shrink-0 rounded-lg p-1.5 text-left ${
          horizontal ? 'w-48' : 'w-36 md:w-full'
        } ${isSelected ? 'bg-selected' : onSelect ? 'hover:bg-hover' : ''}`
        return onSelect ? (
          <button
            key={contentType}
            type="button"
            aria-pressed={isSelected}
            data-testid={`${testIdPrefix}-${contentType}`}
            onClick={() => onSelect(contentType)}
            className={className}
          >
            {body}
          </button>
        ) : (
          <div
            key={contentType}
            data-testid={`theme-slide-${contentType}`}
            className={className}
          >
            {body}
          </div>
        )
      })}
    </div>
  )
}
