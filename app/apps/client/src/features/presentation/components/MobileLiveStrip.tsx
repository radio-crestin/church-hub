import { ChevronLeft, ChevronRight, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ContentTypeButton } from './ContentTypeButton'
import {
  type LiveProgramSteps,
  useClearSlide,
  useMoveLive,
  usePresentationState,
} from '../hooks'

interface MobileLiveStripProps {
  /**
   * The program whose step is on the screens, if any: next and previous walk
   * it, as the arrow keys do.
   */
  liveProgram: LiveProgramSteps | null
}

/**
 * What is on the screens, above the phone's tab bar on every page: its name
 * (a tap opens it, with the preview and every slide) and previous, next and
 * hide, so the operator never has to leave the page they are on.
 */
export function MobileLiveStrip({ liveProgram }: MobileLiveStripProps) {
  const { t } = useTranslation('bible')
  const { data: state } = usePresentationState()
  const { goNext, goPrev } = useMoveLive(liveProgram)
  const clearSlide = useClearSlide()

  const content = state?.temporaryContent
  if (!content || state.isHidden) return null

  const buttonClass =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-300 text-gray-700 active:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:active:bg-gray-700'

  return (
    <div
      data-testid="mobile-live-strip"
      className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/60 border-t border-indigo-200 dark:border-indigo-900"
    >
      <span className="w-2 h-2 shrink-0 rounded-full bg-red-500 animate-pulse" />
      <div className="flex min-w-0 flex-1">
        <ContentTypeButton temporaryContent={content} />
      </div>
      <button
        type="button"
        onClick={goPrev}
        aria-label={t('controls.prev')}
        className={buttonClass}
      >
        <ChevronLeft size={20} />
      </button>
      <button
        type="button"
        onClick={goNext}
        aria-label={t('controls.next')}
        data-testid="mobile-live-strip-next"
        className={buttonClass}
      >
        <ChevronRight size={20} />
      </button>
      <button
        type="button"
        onClick={() => clearSlide.mutate()}
        aria-label={t('controls.hide')}
        data-testid="mobile-live-strip-hide"
        className={`${buttonClass} text-red-600 dark:text-red-400`}
      >
        <EyeOff size={18} />
      </button>
    </div>
  )
}
