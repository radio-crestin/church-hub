import { Loader2, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { formatRelativeTime } from '~/features/sync/utils/formatRelativeTime'
import { Switch } from '~/ui/switch/Switch'
import { useSongUpdates } from '../hooks/useSongUpdates'

/**
 * Settings card for the song updates: adding new songs from the song sources
 * automatically (on by default), and checking the sources now. The checks
 * run on the server, in a worker thread, a bit after start and then daily.
 */
export function DiscoverySyncSettings() {
  const { t, i18n } = useTranslation('songDiscovery')
  const { state, isRunning, checkNow, setAutoUpdate } = useSongUpdates()
  const newCount = state?.sources.reduce((sum, s) => sum + s.newCount, 0) ?? 0

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('settings.title')}
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('settings.description')}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <label
          htmlFor="song-updates-auto"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {t('settings.enableLabel')}
        </label>
        <Switch
          id="song-updates-auto"
          checked={state?.autoUpdate ?? true}
          disabled={!state}
          onCheckedChange={setAutoUpdate}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void checkNow({ force: true })}
          disabled={isRunning}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {t('settings.checkNow')}
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {isRunning
            ? t('source.checkingAll')
            : state?.finishedAt
              ? `${t('source.lastChecked', {
                  when: formatRelativeTime(state.finishedAt, i18n.language),
                })}${newCount > 0 ? ` · ${t('settings.newCount', { count: newCount })}` : ''}`
              : null}
        </span>
      </div>
    </div>
  )
}
