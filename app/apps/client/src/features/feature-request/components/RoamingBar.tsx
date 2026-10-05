import { Camera, Monitor } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useEscapeKey } from '../hooks/useEscapeKey'
import { canCaptureDisplay } from '../utils/captureDisplay'
import { FEATURE_REQUEST_UI_ATTRIBUTE } from '../utils/isFeatureRequestUi'

interface RoamingBarProps {
  onTake: () => void
  onCaptureDisplay: () => void
  onCancel: () => void
}

const barButton =
  'flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors'

/**
 * A small bar floating over the app while the user retakes the screenshot.
 * The app stays usable underneath: "Take screenshot" photographs the page
 * shown then, "Other screen" opens the system picker for any screen or
 * window. The bar never appears in the screenshot itself.
 */
export function RoamingBar({
  onTake,
  onCaptureDisplay,
  onCancel,
}: RoamingBarProps) {
  const { t } = useTranslation()
  useEscapeKey(onCancel)
  return (
    <div
      {...{ [FEATURE_REQUEST_UI_ATTRIBUTE]: '' }}
      data-testid="feature-request-roaming"
      className="fixed left-1/2 -translate-x-1/2 bottom-4 w-[calc(100%-2rem)] max-w-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-xl bg-gray-900/95 text-white shadow-2xl p-3"
      style={{ zIndex: 2147483000 }}
    >
      <p className="flex items-center gap-2 text-sm flex-1">
        <Camera size={18} className="flex-shrink-0 text-indigo-300" />
        {t('common:featureRequest.roamingHint')}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="feature-request-take"
          onClick={onTake}
          className={`${barButton} bg-indigo-600 hover:bg-indigo-500`}
        >
          {t('common:featureRequest.takeScreenshot')}
        </button>
        {canCaptureDisplay() && (
          <button
            type="button"
            data-testid="feature-request-capture-display"
            onClick={onCaptureDisplay}
            className={`${barButton} bg-white/10 hover:bg-white/20`}
          >
            <Monitor size={16} />
            {t('common:featureRequest.otherScreen')}
          </button>
        )}
        <button
          type="button"
          data-testid="feature-request-roaming-cancel"
          onClick={onCancel}
          className={`${barButton} bg-white/10 hover:bg-white/20`}
        >
          {t('common:buttons.cancel')}
        </button>
      </div>
    </div>
  )
}
