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
    <div className="flex flex-shrink-0 items-center justify-center gap-2 pt-3">
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
      <PreviewScreenPicker />
    </div>
  )
}
