import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PreviewScreenPicker } from './PreviewScreenPicker'

interface PreviewNavControlsProps {
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
  /** While a move is in flight presses are ignored; the buttons never dim for it (no flicker). */
  isBusy?: boolean
  /** Hover titles, when they say more than Previous / Next (e.g. "Previous verse"). */
  prevTitle?: string
  nextTitle?: string
  /** Test ids become `${testIdPrefix}-prev` / `-next`. */
  testIdPrefix?: string
}

/** The row under every live preview: Previous, Next, and the screen the previews mirror. */
export function PreviewNavControls({
  onPrev,
  onNext,
  canPrev,
  canNext,
  isBusy = false,
  prevTitle,
  nextTitle,
  testIdPrefix,
}: PreviewNavControlsProps) {
  const { t } = useTranslation('bible')
  const button =
    'flex h-9 items-center gap-2 px-3.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50'

  return (
    // Three columns: the screen picker at the left edge, Previous / Next
    // centred, and an empty column that keeps them centred.
    <div className="grid flex-shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 pt-3">
      <div className="justify-self-start">
        <PreviewScreenPicker align="start" />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => !isBusy && onPrev()}
          disabled={!canPrev}
          title={prevTitle ?? t('controls.prev')}
          data-testid={testIdPrefix ? `${testIdPrefix}-prev` : undefined}
          className={`${button} bg-field text-fg hover:bg-hover`}
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
          {t('controls.prev')}
        </button>
        <button
          type="button"
          onClick={() => !isBusy && onNext()}
          disabled={!canNext}
          title={nextTitle ?? t('controls.next')}
          data-testid={testIdPrefix ? `${testIdPrefix}-next` : undefined}
          className={`${button} bg-primary text-white hover:bg-indigo-700`}
        >
          {t('controls.next')}
          <ChevronRight size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
