import { Play, Repeat, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { OverflowAction } from '~/ui/menu'
import { useBookmarkSlideshow } from '../hooks/useBookmarkSlideshow'
import type { BibleBookmark } from '../service'

const buttonClass =
  'flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium tabular-nums transition-colors disabled:opacity-50'

/**
 * The Marcaje header's slideshow controls: ▶ shows the bookmarks one after
 * another (the arrows step through them), 🔁 plays them in a loop on its own.
 * While one runs, ▶ turns into ■ with the place in the list.
 */
export function useBookmarkSlideshowActions(
  bookmarks: BibleBookmark[],
): OverflowAction[] {
  const { t } = useTranslation('bible')
  const slideshow = useBookmarkSlideshow(bookmarks)
  if (bookmarks.length === 0) return []

  const { isPlaying, isLooping, position } = slideshow
  const playLabel = isPlaying
    ? t('bookmarks.slideshow.stop')
    : t('bookmarks.slideshow.play')
  const togglePlay = () =>
    isPlaying ? slideshow.stop() : slideshow.start(false)
  const loopLabel = isLooping
    ? t('bookmarks.slideshow.stopLoop')
    : t('bookmarks.slideshow.loop')
  const toggleLoop = () =>
    isLooping ? slideshow.stop() : slideshow.start(true)

  return [
    {
      id: 'slideshow-play',
      label: playLabel,
      icon: isPlaying ? <Square size={18} /> : <Play size={18} />,
      onSelect: togglePlay,
      testId: 'bible-bookmarks-play-menu',
      inline: (
        <button
          type="button"
          onClick={togglePlay}
          data-testid="bible-bookmarks-play"
          aria-label={playLabel}
          title={isPlaying ? playLabel : t('bookmarks.slideshow.playHint')}
          className={`${buttonClass} ${
            isPlaying
              ? 'bg-live-tint text-live ring-1 ring-inset ring-live'
              : 'text-fg-label hover:bg-hover hover:text-fg'
          }`}
        >
          {isPlaying ? (
            <Square className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <Play className="h-4 w-4" strokeWidth={1.5} />
          )}
          {position && (
            <span data-testid="bible-bookmarks-play-position">
              {t('bookmarks.slideshow.position', {
                current: position.index + 1,
                count: position.count,
              })}
            </span>
          )}
        </button>
      ),
    },
    {
      id: 'slideshow-loop',
      label: loopLabel,
      icon: <Repeat size={18} />,
      onSelect: toggleLoop,
      testId: 'bible-bookmarks-loop-menu',
      inline: (
        <button
          type="button"
          onClick={toggleLoop}
          data-testid="bible-bookmarks-loop"
          aria-pressed={isLooping}
          aria-label={loopLabel}
          title={isLooping ? loopLabel : t('bookmarks.slideshow.loopHint')}
          className={`${buttonClass} ${
            isLooping
              ? 'bg-selected text-fg'
              : 'text-fg-label hover:bg-hover hover:text-fg'
          }`}
        >
          <Repeat className="h-4 w-4" strokeWidth={1.5} />
        </button>
      ),
    },
  ]
}
