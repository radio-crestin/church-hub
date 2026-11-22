import { MonitorOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ScreenWithConfigs } from '../../types'
import { ScreenPreview } from '../ScreenPreview'

/** The thumbnail's frame; the screen's own proportions fit inside it. */
const FRAME = { width: 224, height: 126 }

interface ScreenIdlePreviewProps {
  screen: ScreenWithConfigs | undefined
  onClick: () => void
}

/**
 * What the projector shows while nothing is live, drawn from the screen's own
 * settings: the empty slide (background, clock) or, when the window closes on
 * hide, the computer's desktop. Opens the empty slide's layout on click.
 */
export function ScreenIdlePreview({ screen, onClick }: ScreenIdlePreviewProps) {
  const { t } = useTranslation('settings')
  const scale = screen
    ? Math.min(FRAME.width / screen.width, FRAME.height / screen.height)
    : 1
  const size = screen
    ? { width: screen.width * scale, height: screen.height * scale }
    : FRAME

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="screen-idle-preview"
      data-closes={screen?.closeOnEscape ? 'true' : 'false'}
      title={t('sections.screens.idle.editEmptySlide')}
      className="relative flex-shrink-0 max-w-full overflow-hidden rounded-md border border-gray-300 dark:border-gray-600 bg-black hover:ring-2 hover:ring-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      style={size}
    >
      {screen && !screen.closeOnEscape && (
        <ScreenPreview screen={screen} contentType="empty" contentData={{}} />
      )}
      {screen?.closeOnEscape && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gray-700 p-2 text-center text-gray-200">
          <MonitorOff className="w-5 h-5" />
          <span className="text-xs leading-tight">
            {t('sections.screens.idle.windowCloses')}
          </span>
        </div>
      )}
    </button>
  )
}
