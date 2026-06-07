import { Database, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { usePermissions } from '~/provider/permissions-provider'
import { Button } from '~/ui/button'
import { Combobox } from '~/ui/combobox'
import { useToast } from '~/ui/toast'
import { useSearchEngine } from '../hooks/useSearchEngine'
import type { ChromaStatus, SearchEngine } from '../types'
import { SEARCH_ENGINES } from '../types'

function stateBadgeClasses(state: ChromaStatus['state']): string {
  switch (state) {
    case 'ready':
      return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
    case 'syncing':
    case 'starting':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
    case 'error':
      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

export function SearchEngineSettings() {
  const { t } = useTranslation('settings')
  const { hasPermission } = usePermissions()
  const { showToast } = useToast()
  const { data, isLoading, setEngine, resync } = useSearchEngine()

  const canEdit = hasPermission('settings.edit')
  const chroma = data?.chroma

  const engineOptions = SEARCH_ENGINES.map((engine) => ({
    value: engine,
    label: t(`sections.searchEngine.engines.${engine}`),
  }))

  const handleEngineChange = async (value: number | string | null) => {
    if (!value) return
    const info = await setEngine.mutateAsync(value as SearchEngine)
    if (info) {
      showToast(t('sections.searchEngine.toast.engineChanged'), 'success')
    } else {
      showToast(t('sections.searchEngine.toast.engineChangeFailed'), 'error')
    }
  }

  const handleResync = async () => {
    const started = await resync.mutateAsync()
    if (started) {
      showToast(t('sections.searchEngine.toast.resyncStarted'), 'success')
    } else {
      showToast(t('sections.searchEngine.toast.resyncFailed'), 'error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Engine selector */}
      <div className="space-y-2">
        <label
          htmlFor="search-engine-select"
          className="text-sm font-medium text-gray-900 dark:text-white"
        >
          {t('sections.searchEngine.engineLabel')}
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('sections.searchEngine.engineDescription')}
        </p>
        <div id="search-engine-select" data-testid="search-engine-select">
          <Combobox
            options={engineOptions}
            value={data?.configured ?? 'sqlite'}
            onChange={handleEngineChange}
            disabled={isLoading || !canEdit || setEngine.isPending}
            allowClear={false}
          />
        </div>
        {data?.fallback && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t('sections.searchEngine.fallbackNotice')}
          </p>
        )}
      </div>

      {/* Chroma status card */}
      <div
        className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800"
        data-testid="chroma-status-card"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                {t('sections.searchEngine.chromaStatus.title')}
              </h4>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {t('sections.searchEngine.chromaStatus.description')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              data-testid="chroma-state-badge"
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${stateBadgeClasses(chroma?.state ?? 'stopped')}`}
            >
              {t(`sections.searchEngine.states.${chroma?.state ?? 'stopped'}`)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResync}
              disabled={
                !canEdit || resync.isPending || chroma?.state === 'syncing'
              }
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${resync.isPending || chroma?.state === 'syncing' ? 'animate-spin' : ''}`}
              />
              {t('sections.searchEngine.resync')}
            </Button>
          </div>
        </div>

        {/* Sync progress */}
        {chroma?.state === 'syncing' && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {t('sections.searchEngine.syncing', {
                  step: chroma.step ?? '…',
                })}
              </span>
              <span>{Math.round(chroma.progress * 100)}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                style={{ width: `${Math.round(chroma.progress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Document counts */}
        {chroma && chroma.state !== 'disabled' && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-white p-2 dark:bg-gray-900">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {chroma.counts.songs.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t('sections.searchEngine.counts.songs')}
              </div>
            </div>
            <div className="rounded-md bg-white p-2 dark:bg-gray-900">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {chroma.counts.bible_verses.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t('sections.searchEngine.counts.bible')}
              </div>
            </div>
            <div className="rounded-md bg-white p-2 dark:bg-gray-900">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {chroma.counts.schedules.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t('sections.searchEngine.counts.schedules')}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {chroma?.lastError && chroma.state === 'error' && (
          <p className="mt-3 break-all text-xs text-red-600 dark:text-red-400">
            {chroma.lastError}
          </p>
        )}
      </div>
    </div>
  )
}
