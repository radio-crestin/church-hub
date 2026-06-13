import { Loader2, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Switch } from '~/ui/switch/Switch'
import { useSongDiscovery } from '../context/SongDiscoveryContext'

/**
 * Settings card to toggle the background "new songs" check on/off and trigger
 * an immediate check. Lives in the Songs settings panel.
 */
export function DiscoverySyncSettings() {
  const { t } = useTranslation('songDiscovery')
  const { enabled, setEnabled, isChecking, checkNow, newCount } =
    useSongDiscovery()

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('settings.title')}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('settings.description')}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <label
          htmlFor="discovery-sync-enabled"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {t('settings.enableLabel')}
        </label>
        <Switch
          id="discovery-sync-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => checkNow({ force: true })}
          disabled={!enabled || isChecking}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100 rounded-lg transition-colors disabled:opacity-50"
        >
          {isChecking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {t('settings.checkNow')}
        </button>
        {newCount > 0 && (
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {t('settings.newCount', { count: newCount })}
          </span>
        )}
      </div>
    </div>
  )
}
