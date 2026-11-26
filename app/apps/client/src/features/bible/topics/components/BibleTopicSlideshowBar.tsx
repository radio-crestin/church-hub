import { Play, Repeat, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { TemplatePicker } from '~/features/slide-templates/components/TemplatePicker'
import type { useVerseSlideshow } from '../../hooks/useVerseSlideshow'

interface BibleTopicSlideshowBarProps {
  slideshow: ReturnType<typeof useVerseSlideshow>
  /** The topic's template: the one chosen for it, else its fitting one. */
  templateId: number | null
  onTemplateChange: (templateId: number | null) => void
}

const buttonClass =
  'flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors'

/**
 * The topic as a presentation in one tap: ▶ shows its verses one after
 * another, each for its reading time, and stops on the last; 🔁 plays them
 * over and over. While one plays, ■ stops it.
 */
export function BibleTopicSlideshowBar({
  slideshow,
  templateId,
  onTemplateChange,
}: BibleTopicSlideshowBarProps) {
  const { t } = useTranslation('bible')
  const { isPlaying, isLooping, position } = slideshow

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 border-b border-line flex-shrink-0">
      {isPlaying ? (
        <button
          type="button"
          onClick={slideshow.stop}
          data-testid="bible-topic-stop"
          className={`${buttonClass} bg-live-tint text-live ring-1 ring-inset ring-live`}
        >
          <Square className="h-4 w-4" strokeWidth={1.5} />
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
          className={`${buttonClass} text-fg-label hover:bg-hover hover:text-fg`}
        >
          <Play className="h-4 w-4" strokeWidth={1.5} />
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
            ? 'bg-selected text-fg'
            : 'text-fg-label hover:bg-hover hover:text-fg'
        }`}
      >
        <Repeat className="h-4 w-4" strokeWidth={1.5} />
        {t('topics.slideshow.loop')}
      </button>
      <div className="ml-auto min-w-0">
        <TemplatePicker
          variant="chip"
          value={templateId}
          onChange={onTemplateChange}
          testId="bible-topic-template"
        />
      </div>
    </div>
  )
}
