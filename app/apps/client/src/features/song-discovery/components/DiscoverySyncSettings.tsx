import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { formatRelativeTime } from '~/features/sync/utils/formatRelativeTime'
import { Switch } from '~/ui/switch/Switch'
import { RecoverTitlesButton } from './RecoverTitlesButton'
import { useSongUpdates } from '../hooks/useSongUpdates'
import { useSourceErrors } from '../hooks/useSourceErrors'

/**
 * Settings card for the song sync: syncing new songs and updates without
 * asking (on by default), checking the sources now, why a source's last
 * check failed, and recovering the original titles. The checks run on the
 * server, in a worker thread, a bit after start and then daily.
 */
export function DiscoverySyncSettings() {
  const { t, i18n } = useTranslation('songDiscovery')
  const { state, isRunning, checkNow, setAutoUpdate, pendingCount } =
    useSongUpdates()
  const errors = useSourceErrors()

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-fg">
          {t('settings.title')}
        </h3>
        <p className="mt-1 text-sm text-fg-hint">{t('settings.description')}</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <label
            htmlFor="song-updates-auto"
            className="text-sm font-medium text-fg-body"
          >
            {t('settings.enableLabel')}
          </label>
          <p className="text-xs text-fg-hint">{t('settings.enableHint')}</p>
        </div>
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
          className="inline-flex items-center gap-2 rounded-lg bg-field px-4 py-2 text-sm font-medium text-fg-body transition-colors hover:bg-hover disabled:opacity-50"
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {t('settings.checkNow')}
        </button>
        <span className="text-sm text-fg-label">
          {isRunning
            ? t('source.checkingAll')
            : state?.finishedAt
              ? `${t('source.lastChecked', {
                  when: formatRelativeTime(state.finishedAt, i18n.language),
                })}${pendingCount > 0 ? ` · ${t('settings.pendingCount', { count: pendingCount })}` : ''}`
              : null}
        </span>
      </div>

      {errors.size > 0 && (
        <ul className="space-y-1">
          {state?.sources
            .filter((source) => errors.has(source.sourceId))
            .map((source) => (
              <li
                key={source.sourceId}
                data-testid={`source-error-${source.sourceId}`}
                className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0 break-words">
                  <span className="font-medium">{source.name}</span>
                  {': '}
                  {errors.get(source.sourceId)}
                </span>
              </li>
            ))}
        </ul>
      )}

      <div className="border-t border-line pt-4">
        <RecoverTitlesButton />
      </div>
    </div>
  )
}
