import {
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Loader2,
  MonitorUp,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PhoneBottomBar } from '~/ui/layout/phone-bottom-bar'

/** The middle button's other job, in place of hiding what is live. */
interface PhoneSlideAction {
  onClick: () => void
  isPending: boolean
}

interface PhoneSlideControlsProps {
  /** Prefix of the bar's test ids (`<testId>-prev`, `<testId>-next`, …). */
  testId: string
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
  isNavigating: boolean
  /** What this page shows is on the screens: the middle button hides it. */
  isLive: boolean
  onHide: () => void
  isHiding: boolean
  /** A staged slide (the song's Preview mode) waits: the middle button shows it. */
  project?: PhoneSlideAction
  /** The page is one the tab bar leads to: the tab bar stays under the bar. */
  keepsTabBar?: boolean
}

/**
 * Previous, hide (or show the staged slide) and next, as large buttons at the bottom of a phone
 * screen where the thumb reaches them.
 */
export function PhoneSlideControls({
  testId,
  onPrev,
  onNext,
  canPrev,
  canNext,
  isNavigating,
  isLive,
  onHide,
  isHiding,
  project,
  keepsTabBar = false,
}: PhoneSlideControlsProps) {
  const { t } = useTranslation(['bible', 'songs'])
  const buttonClass =
    'flex h-12 items-center justify-center gap-1.5 rounded-lg text-[15px] font-medium transition-colors disabled:opacity-40'
  const iconButtonClass = `${buttonClass} w-14 shrink-0 bg-field`

  const middle = project ? (
    <button
      type="button"
      onClick={project.onClick}
      disabled={project.isPending}
      data-testid={`${testId}-project`}
      className={`${buttonClass} flex-1 bg-primary text-white active:bg-indigo-700`}
    >
      {project.isPending ? (
        <Loader2 size={20} strokeWidth={1.5} className="animate-spin" />
      ) : (
        <MonitorUp size={20} strokeWidth={1.5} />
      )}
      {t('songs:preview.project')}
    </button>
  ) : (
    <button
      type="button"
      onClick={onHide}
      disabled={!isLive || isHiding}
      aria-label={t('controls.hide')}
      data-testid={`${testId}-hide`}
      className={`${iconButtonClass} text-fg active:bg-hover`}
    >
      {isHiding ? (
        <Loader2 size={20} strokeWidth={1.5} className="animate-spin" />
      ) : (
        <EyeOff size={20} strokeWidth={1.5} />
      )}
    </button>
  )

  return (
    <PhoneBottomBar keepsTabBar={keepsTabBar}>
      <div
        data-testid={`${testId}-controls`}
        className="flex gap-2 px-3 py-2 bg-panel border-t border-line"
      >
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev || isNavigating || isHiding}
          data-testid={`${testId}-prev`}
          className={`${buttonClass} flex-1 bg-field text-fg active:bg-hover`}
        >
          <ChevronLeft size={20} strokeWidth={1.5} />
          {t('controls.prev')}
        </button>
        {middle}
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext || isNavigating || isHiding}
          data-testid={`${testId}-next`}
          className={`${buttonClass} flex-1 bg-primary text-white active:bg-indigo-700`}
        >
          {t('controls.next')}
          <ChevronRight size={20} strokeWidth={1.5} />
        </button>
      </div>
    </PhoneBottomBar>
  )
}
