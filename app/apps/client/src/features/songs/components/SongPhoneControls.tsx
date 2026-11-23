import {
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Loader2,
  MonitorUp,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PhoneBottomBar } from '~/ui/layout/phone-bottom-bar'

interface SongPhoneControlsProps {
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
  isNavigating: boolean
  /** This song is on the screens: the middle button hides it. */
  isLive: boolean
  onHide: () => void
  isHiding: boolean
  /** A staged slide (Preview mode) waits: the middle button shows it. */
  canProject: boolean
  onProject: () => void
  isProjecting: boolean
}

/**
 * Previous, hide (or show the staged slide) and next, as large buttons at the
 * bottom of a phone screen where the thumb reaches them.
 */
export function SongPhoneControls({
  onPrev,
  onNext,
  canPrev,
  canNext,
  isNavigating,
  isLive,
  onHide,
  isHiding,
  canProject,
  onProject,
  isProjecting,
}: SongPhoneControlsProps) {
  const { t } = useTranslation(['songs', 'bible'])
  const buttonClass =
    'flex h-12 items-center justify-center gap-1.5 rounded-xl text-base font-semibold transition-colors disabled:opacity-40'

  return (
    <PhoneBottomBar>
      <div
        data-testid="song-phone-controls"
        className="flex gap-2 px-3 py-2 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800"
      >
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev || isNavigating || isHiding}
          data-testid="song-phone-prev"
          className={`${buttonClass} flex-1 border border-gray-300 text-gray-800 active:bg-gray-100 dark:border-gray-600 dark:text-gray-100 dark:active:bg-gray-800`}
        >
          <ChevronLeft size={20} />
          {t('bible:controls.prev')}
        </button>
        {canProject ? (
          <button
            type="button"
            onClick={onProject}
            disabled={isProjecting}
            data-testid="song-phone-project"
            className={`${buttonClass} flex-1 bg-green-600 text-white active:bg-green-700`}
          >
            {isProjecting ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <MonitorUp size={20} />
            )}
            {t('preview.project')}
          </button>
        ) : (
          <button
            type="button"
            onClick={onHide}
            disabled={!isLive || isHiding}
            aria-label={t('bible:controls.hide')}
            data-testid="song-phone-hide"
            className={`${buttonClass} w-14 shrink-0 border border-gray-300 text-red-600 active:bg-red-50 dark:border-gray-600 dark:text-red-400 dark:active:bg-gray-800`}
          >
            {isHiding ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <EyeOff size={20} />
            )}
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext || isNavigating || isHiding}
          data-testid="song-phone-next"
          className={`${buttonClass} flex-1 bg-indigo-600 text-white active:bg-indigo-700`}
        >
          {t('bible:controls.next')}
          <ChevronRight size={20} />
        </button>
      </div>
    </PhoneBottomBar>
  )
}
