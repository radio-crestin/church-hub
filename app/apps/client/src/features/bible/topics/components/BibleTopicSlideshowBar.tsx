import { Play, Repeat, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { useVerseSlideshow } from '../../hooks/useVerseSlideshow'

interface BibleTopicSlideshowBarProps {
  slideshow: ReturnType<typeof useVerseSlideshow>
}

const buttonClass =
  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors'

/**
 * The topic as a presentation in one tap: ▶ shows its verses one after
 * another, each for its reading time, and stops on the last; 🔁 plays them
 * over and over. While one plays, ■ stops it.
 */
export function BibleTopicSlideshowBar({
  slideshow,
}: BibleTopicSlideshowBarProps) {
  const { t } = useTranslation('bible')
  const { isPlaying, isLooping, position } = slideshow

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
      {isPlaying ? (
        <button
          type="button"
          onClick={slideshow.stop}
          data-testid="bible-topic-stop"
          className={`${buttonClass} bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50`}
        >
          <Square className="h-3.5 w-3.5" />
          {t('topics.slideshow.stop')}
          {position && (
            <span
              data-testid="bible-topic-play-position"
              className="tabular-nums"
            >
              {position.index + 1}/{position.count}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => slideshow.start('once')}
          data-testid="bible-topic-play"
          title={t('topics.slideshow.playHint')}
          className={`${buttonClass} bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50`}
        >
          <Play className="h-3.5 w-3.5" />
          {t('topics.slideshow.play')}
        </button>
      )}
      <button
        type="button"
        onClick={() => (isLooping ? slideshow.stop() : slideshow.start('loop'))}
        data-testid="bible-topic-loop"
        aria-pressed={isLooping}
        title={t('topics.slideshow.loopHint')}
        className={`${buttonClass} ${
          isLooping
            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50'
        }`}
      >
        <Repeat className="h-3.5 w-3.5" />
        {t('topics.slideshow.loop')}
      </button>
    </div>
  )
}
