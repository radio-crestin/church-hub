import { Camera } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useEscapeKey } from '../hooks/useEscapeKey'
import { FEATURE_REQUEST_UI_ATTRIBUTE } from '../utils/isFeatureRequestUi'

interface RoamingBarProps {
  onTake: () => void
  onCancel: () => void
}

/**
 * A small bar floating over the app while the user goes to another page.
 * The app stays usable underneath; "Take screenshot" photographs whatever
 * is shown then. It never appears in the screenshot itself.
 */
export function RoamingBar({ onTake, onCancel }: RoamingBarProps) {
  const { t } = useTranslation()
  useEscapeKey(onCancel)
  return (
    <div
      {...{ [FEATURE_REQUEST_UI_ATTRIBUTE]: '' }}
      data-testid="feature-request-roaming"
      className="fixed left-1/2 -translate-x-1/2 bottom-4 w-[calc(100%-2rem)] max-w-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-xl bg-gray-900/95 text-white shadow-2xl p-3"
      style={{ zIndex: 2147483000 }}
    >
      <p className="flex items-center gap-2 text-sm flex-1">
        <Camera size={18} className="flex-shrink-0 text-indigo-300" />
        {t('common:featureRequest.roamingHint')}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="feature-request-take"
          onClick={onTake}
          className="flex-1 sm:flex-none px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors"
        >
          {t('common:featureRequest.takeScreenshot')}
        </button>
        <button
          type="button"
          data-testid="feature-request-roaming-cancel"
          onClick={onCancel}
          className="flex-1 sm:flex-none px-3 py-2 text-sm font-medium rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        >
          {t('common:buttons.cancel')}
        </button>
      </div>
    </div>
  )
}
