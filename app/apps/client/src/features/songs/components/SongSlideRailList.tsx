import { useTranslation } from 'react-i18next'

import { stripHtmlTags } from '../utils/stripHtmlTags'

export interface SongSlideRailItem {
  /** Stable key for the row. */
  key: string
  /** Slide HTML — stripped to plain lyrics for the list. */
  content: string
  /** Section label ("V1", "C1", …), when the song has them. */
  label?: string | null
  /** A chorus repeat inserted between verses, dimmed and marked as such. */
  isDuplicate?: boolean
}

interface SongSlideRailListProps {
  items: SongSlideRailItem[]
  /** The slide on the projector — green. */
  presentedIndex: number | null
  /** The slide selected or staged but not projected — indigo. */
  highlightedIndex: number | null
  /** Reader-controlled font size for the lyrics. */
  textStyle?: React.CSSProperties
  presentedRef?: React.RefObject<HTMLButtonElement | null>
  highlightedRef?: React.RefObject<HTMLButtonElement | null>
  onSlideClick: (index: number) => void
  onSlideDoubleClick?: (index: number) => void
  /** Row testids are `${testIdPrefix}-${index}`. */
  testIdPrefix?: string
}

/**
 * The song's lyrics as a clickable list — the left rail on the song page and on
 * the song editor. Purely presentational: whoever renders it decides what each
 * click means (project it, stage it, jump the program to it) and which row is
 * green or indigo.
 */
export function SongSlideRailList({
  items,
  presentedIndex,
  highlightedIndex,
  textStyle,
  presentedRef,
  highlightedRef,
  onSlideClick,
  onSlideDoubleClick,
  testIdPrefix = 'song-slide',
}: SongSlideRailListProps) {
  const { t } = useTranslation('songs')

  return (
    <div className="space-y-1">
      {items.map((item, index) => {
        const isPresented = index === presentedIndex
        const isHighlighted = !isPresented && index === highlightedIndex
        const plainText = stripHtmlTags(item.content)

        const getButtonClass = () => {
          if (isPresented) return 'bg-live-tint ring-1 ring-inset ring-live'
          if (isHighlighted) return 'bg-selected'
          return 'hover:bg-hover'
        }

        const getNumberClass = () => {
          if (isPresented) return 'text-live'
          if (isHighlighted) return 'text-fg'
          return 'text-fg-hint'
        }

        const getTextClass = () => {
          if (isPresented || isHighlighted) return 'text-fg'
          return 'text-fg-body'
        }

        const getRef = () => {
          if (isPresented) return presentedRef
          if (isHighlighted) return highlightedRef
          return null
        }

        return (
          <button
            key={item.key}
            ref={getRef()}
            type="button"
            data-testid={`${testIdPrefix}-${index}`}
            aria-current={isPresented ? 'true' : undefined}
            onClick={() => !isPresented && onSlideClick(index)}
            onDoubleClick={() => !isPresented && onSlideDoubleClick?.(index)}
            className={`w-full text-left px-2 py-2 rounded-lg transition-colors group ${getButtonClass()} ${
              item.isDuplicate ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-start gap-2">
              <span
                style={textStyle}
                className={`font-medium tabular-nums min-w-[24px] ${getNumberClass()}`}
              >
                {index + 1}
              </span>
              <span
                style={textStyle}
                className={`whitespace-pre-line flex-1 ${getTextClass()}`}
              >
                {plainText}
              </span>
              {item.isDuplicate && (
                <span className="text-xs text-fg-hint italic shrink-0">
                  {t('preview.chorusRepeat')}
                </span>
              )}
            </div>
            {item.label && (
              <span className="text-xs text-fg-hint ml-8 mt-1 block">
                {item.label}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
