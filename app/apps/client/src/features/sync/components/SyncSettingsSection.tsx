import { AlertTriangle, Clock, Loader2, RefreshCw } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { SyncChangesList } from './SyncChangesList'
import { SyncPendingList } from './SyncPendingList'
import { useSyncConfig } from '../hooks/useSyncConfig'
import { useSyncNow } from '../hooks/useSyncNow'
import { useSyncStatus } from '../hooks/useSyncStatus'
import type { SyncNowResult } from '../service'

const POLL_INTERVAL_OPTIONS_MINUTES = [1, 5, 15, 30]

function formatDate(ms: number | null): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleString()
}

/**
 * Settings card for the Google Drive library sync: enable toggle, poll
 * interval, last sync/error info and a manual "Sync now" action. Rendered
 * below the backup section since sync rides on the same Drive connection.
 */
export function SyncSettingsSection() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const statusQuery = useSyncStatus()
  const { updateConfig, isUpdating } = useSyncConfig()
  const syncNowMutation = useSyncNow()

  const status = statusQuery.data
  const connected = status?.connected ?? false
  const enabled = status?.enabled ?? false

  const showConfigError = useCallback(() => {
    showToast(t('sections.sync.toast.configFailed'), 'error')
  }, [showToast, t])

  const handleToggle = useCallback(async () => {
    try {
      await updateConfig({ syncEnabled: !enabled })
    } catch {
      showConfigError()
    }
  }, [enabled, updateConfig, showConfigError])

  const handleIntervalChange = useCallback(
    async (minutes: number) => {
      try {
        await updateConfig({ pollIntervalMinutes: minutes })
      } catch {
        showConfigError()
      }
    },
    [updateConfig, showConfigError],
  )

  const showSyncResult = useCallback(
    (result: SyncNowResult) => {
      if (!result.success) {
        showToast(
          t('sections.sync.toast.syncFailed', { error: result.error ?? '' }),
          'error',
        )
        return
      }
      if (result.skipped === 'disabled') {
        showToast(t('sections.sync.toast.syncDisabled'), 'error')
      } else if (result.skipped === 'not_connected') {
        showToast(t('sections.sync.toast.syncNotConnected'), 'error')
      } else if (result.skipped === 'no_changes') {
        showToast(t('sections.sync.toast.syncUpToDate'), 'success')
      } else if (result.applied) {
        showToast(
          t('sections.sync.toast.syncApplied', { count: result.applied }),
          'success',
        )
      } else {
        showToast(t('sections.sync.toast.syncComplete'), 'success')
      }
    },
    [showToast, t],
  )

  const handleSyncNow = useCallback(async () => {
    try {
      const result = await syncNowMutation.mutateAsync()
      showSyncResult(result)
    } catch (error) {
      showToast(
        t('sections.sync.toast.syncFailed', {
          error: error instanceof Error ? error.message : '',
        }),
        'error',
      )
    }
  }, [syncNowMutation, showSyncResult, showToast, t])

  if (statusQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-line p-4 text-[13px] text-fg-hint">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('sections.sync.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Enable toggle */}
      <div className="rounded-xl border border-line p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-[13px] font-medium text-fg">
              {t('sections.sync.toggle.title')}
            </h4>
            <p className="mt-0.5 text-xs text-fg-hint">
              {t('sections.sync.toggle.description')}
            </p>
            {!connected && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                {t('sections.sync.toggle.notConnectedHint')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleToggle}
            disabled={!connected || isUpdating}
            aria-label={t('sections.sync.toggle.title')}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              enabled ? 'bg-primary' : 'bg-line-strong'
            } ${!connected || isUpdating ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-panel shadow ring-0 transition duration-200 ease-in-out ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Poll interval */}
        {enabled && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-fg-label">
              {t('sections.sync.interval.label')}
            </p>
            <div className="inline-flex flex-wrap gap-1 rounded-lg bg-field p-1">
              {POLL_INTERVAL_OPTIONS_MINUTES.map((minutes) => {
                const selected = status?.pollIntervalMinutes === minutes
                return (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => handleIntervalChange(minutes)}
                    disabled={isUpdating}
                    aria-pressed={selected}
                    className={`min-w-[3rem] rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                      selected
                        ? 'bg-selected text-fg'
                        : 'text-fg-label hover:bg-hover hover:text-fg'
                    }`}
                  >
                    {minutes}m
                  </button>
                )
              })}
            </div>
            <p className="mt-1.5 text-xs text-fg-hint">
              {t('sections.sync.interval.everyMinutes', {
                minutes: status?.pollIntervalMinutes ?? 5,
              })}
            </p>
          </div>
        )}
      </div>

      {/* Status + manual sync */}
      <div className="flex flex-col items-start gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs text-fg-hint">
            <Clock strokeWidth={1.75} className="h-3.5 w-3.5" />
            {t('sections.sync.status.lastSync')}:{' '}
            {status?.lastSyncAt
              ? formatDate(status.lastSyncAt)
              : t('sections.sync.status.never')}
          </p>
          {(status?.pendingCount ?? 0) > 0 && (
            <p className="mt-1 text-xs text-fg-hint">
              {t('sections.sync.status.pendingCount', {
                count: status?.pendingCount ?? 0,
              })}
            </p>
          )}
          {status?.lastError && (
            <p className="mt-1 flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle
                strokeWidth={1.75}
                className="mt-0.5 h-3.5 w-3.5 flex-shrink-0"
              />
              {t('sections.sync.status.lastError')}: {status.lastError}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={!connected || !enabled || syncNowMutation.isPending}
          className="inline-flex h-8 items-center gap-2 self-stretch justify-center rounded-lg bg-primary px-3 text-[13px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50 sm:self-auto"
        >
          {syncNowMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw strokeWidth={1.5} className="h-4 w-4" />
          )}
          {syncNowMutation.isPending
            ? t('sections.sync.now.syncing')
            : t('sections.sync.now.button')}
        </button>
      </div>

      {/* Changes lists: local queue + history received from other devices */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SyncPendingList />
        <SyncChangesList />
      </div>
    </div>
  )
}
