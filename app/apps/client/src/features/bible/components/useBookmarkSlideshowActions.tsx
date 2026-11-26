import { Play, Repeat, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { HeaderIconButton } from '~/ui/button'
import type { OverflowAction } from '~/ui/menu'
import { useBookmarkSlideshow } from '../hooks/useBookmarkSlideshow'
import type { BibleBookmark } from '../service'

/**
 * The Marcaje header's slideshow controls, icon buttons like a topic's: ▶
 * shows the bookmarks one after another (the arrows step through them), 🔁
 * plays them in a loop on its own. Pressed again, either stops it (▶ turns
 * into ■); the other switches mode from the verse on screen. While one runs,
 * the place in the list shows beside ▶.
 */
export function useBookmarkSlideshowActions(
  bookmarks: BibleBookmark[],
): OverflowAction[] {
  const { t } = useTranslation('bible')
  const slideshow = useBookmarkSlideshow(bookmarks)
  if (bookmarks.length === 0) return []

  const { isPlaying, isLooping, position } = slideshow
  const isStepping = isPlaying && !isLooping
  const from = position?.index ?? 0
  const togglePlay = () =>
    isStepping ? slideshow.stop() : slideshow.start(false, from)
  const toggleLoop = () =>
    isLooping ? slideshow.stop() : slideshow.start(true, from)

  return [
    {
      id: 'slideshow-play',
      label: isStepping
        ? t('bookmarks.slideshow.stop')
        : t('bookmarks.slideshow.play'),
      description: isStepping ? undefined : t('bookmarks.slideshow.playHint'),
      icon: isStepping ? <Square size={18} /> : <Play size={18} />,
      onSelect: togglePlay,
      testId: 'bible-bookmarks-play-menu',
      inline: (
        <div className="flex items-center gap-1">
          <HeaderIconButton
            label={t('bookmarks.slideshow.play')}
            tooltip={isStepping ? t('bookmarks.slideshow.stop') : undefined}
            pressed={isStepping}
            onClick={togglePlay}
            data-testid="bible-bookmarks-play"
          >
            {isStepping ? (
              <Square size={16} strokeWidth={1.5} />
            ) : (
              <Play size={16} strokeWidth={1.5} />
            )}
          </HeaderIconButton>
          {position && (
            <span
              data-testid="bible-bookmarks-play-position"
              className="text-xs tabular-nums text-fg-hint"
            >
              {t('bookmarks.slideshow.position', {
                current: position.index + 1,
                count: position.count,
              })}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'slideshow-loop',
      label: isLooping
        ? t('bookmarks.slideshow.stopLoop')
        : t('bookmarks.slideshow.loop'),
      description: isLooping ? undefined : t('bookmarks.slideshow.loopHint'),
      icon: <Repeat size={18} />,
      onSelect: toggleLoop,
      active: isLooping,
      testId: 'bible-bookmarks-loop-menu',
      inline: (
        <HeaderIconButton
          label={t('bookmarks.slideshow.loop')}
          tooltip={isLooping ? t('bookmarks.slideshow.stopLoop') : undefined}
          pressed={isLooping}
          onClick={toggleLoop}
          data-testid="bible-bookmarks-loop"
        >
          <Repeat size={16} strokeWidth={1.5} />
        </HeaderIconButton>
      ),
    },
  ]
}
