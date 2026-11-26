import { Play, Repeat, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { TemplatePicker } from '~/features/slide-templates/components/TemplatePicker'
import { HeaderIconButton } from '~/ui/button'
import { ReadingSpeedControl } from '../../components/ReadingSpeedControl'
import type { useVerseSlideshow } from '../../hooks/useVerseSlideshow'

interface BibleTopicSlideshowBarProps {
  slideshow: ReturnType<typeof useVerseSlideshow>
  /** The topic's template: the one chosen for it, else its fitting one. */
  templateId: number | null
  onTemplateChange: (templateId: number | null) => void
}

/**
 * The topic as a presentation in one tap: ▶ shows its verses one after
 * another, each for its reading time, and stops on the last; 🔁 plays them
 * over and over. Pressed again (▶ turns into ■), either stops it; the
 * other switches mode from the verse on screen. The gauge sets the reading
 * speed.
 */
export function BibleTopicSlideshowBar({
  slideshow,
  templateId,
  onTemplateChange,
}: BibleTopicSlideshowBarProps) {
  const { t } = useTranslation('bible')
  const { isAutoAdvancing, isLooping, position } = slideshow
  const from = position?.index ?? 0

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-line flex-shrink-0">
      <HeaderIconButton
        label={t('topics.slideshow.play')}
        tooltip={isAutoAdvancing ? t('topics.slideshow.stopPlay') : undefined}
        pressed={isAutoAdvancing}
        data-testid="bible-topic-play"
        onClick={() =>
          isAutoAdvancing ? slideshow.stop() : slideshow.start('once', from)
        }
      >
        {isAutoAdvancing ? (
          <Square size={16} strokeWidth={1.5} />
        ) : (
          <Play size={16} strokeWidth={1.5} />
        )}
      </HeaderIconButton>
      <HeaderIconButton
        label={t('topics.slideshow.loop')}
        tooltip={isLooping ? t('topics.slideshow.stopLoop') : undefined}
        pressed={isLooping}
        data-testid="bible-topic-loop"
        onClick={() =>
          isLooping ? slideshow.stop() : slideshow.start('loop', from)
        }
      >
        <Repeat size={16} strokeWidth={1.5} />
      </HeaderIconButton>
      <ReadingSpeedControl testId="bible-topic-speed" />
      <div className="ml-auto">
        <TemplatePicker
          variant="icon"
          value={templateId}
          onChange={onTemplateChange}
          testId="bible-topic-template"
        />
      </div>
    </div>
  )
}
