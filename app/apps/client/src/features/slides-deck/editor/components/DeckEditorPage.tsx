import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useSchedule } from '~/features/schedules/hooks/useSchedule'
import { DeckEditor } from './DeckEditor'
import type { SlideDeck } from '../../types'
import { deckFirstText } from '../../utils/deckFirstText'

interface DeckEditorPageProps {
  scheduleId: number
  itemId: number
  slideIndex: number
  onBack: () => void
}

/** The editor page of a presentation's Slides item, once its deck has loaded. */
export function DeckEditorPage({
  scheduleId,
  itemId,
  slideIndex,
  onBack,
}: DeckEditorPageProps) {
  const { t } = useTranslation('schedules')
  const { data: schedule, isLoading } = useSchedule(scheduleId)
  const item = schedule?.items.find((i) => i.id === itemId)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" />
      </div>
    )
  }
  if (!item || item.itemType !== 'slides') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-600 dark:text-gray-300">
        <p>{t('deckEditor.notFound')}</p>
        <button
          type="button"
          onClick={onBack}
          className="text-indigo-600 hover:underline"
        >
          {t('deckEditor.back')}
        </button>
      </div>
    )
  }
  const deck = item.itemConfig as SlideDeck
  return (
    <div className="h-full min-h-0">
      <DeckEditor
        // Loaded once: later saves come from here, not back into it.
        key={item.id}
        scheduleId={scheduleId}
        itemId={item.id}
        title={`${schedule?.title ?? ''} · ${deckFirstText(deck) || t('slidesDeck.title')}`}
        initialDeck={deck}
        initialSlideIndex={slideIndex}
        onBack={onBack}
      />
    </div>
  )
}
