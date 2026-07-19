import { useNavigate } from '@tanstack/react-router'
import { CheckCheck, Inbox, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SyncChangeKindBadge } from './SyncChangeKindBadge'
import { useMarkSyncUpdatesSeen } from '../hooks/useMarkSyncUpdatesSeen'
import { useSyncRecentUpdates } from '../hooks/useSyncRecentUpdates'
import type { SyncUpdate } from '../service'
import { formatRelativeTime } from '../utils/formatRelativeTime'

/** Newest-first history entries shown before the list is cut off. */
const MAX_DISPLAYED_UPDATES = 20

/**
 * "Received from other devices": recent sync history (newest first). Unseen
 * rows are highlighted; rows for an existing song/schedule navigate to it.
 */
export function SyncChangesList() {
  const { t, i18n } = useTranslation('settings')
  const navigate = useNavigate()
  const { data: updates } = useSyncRecentUpdates()
  const markSeenMutation = useMarkSyncUpdatesSeen()

  const displayed = (updates ?? []).slice(0, MAX_DISPLAYED_UPDATES)
  const hasUnseen = (updates ?? []).some((update) => !update.seen)

  const openEntity = (update: SyncUpdate) => {
    if (update.localId === null) return
    if (update.entityType === 'song') {
      navigate({
        to: '/songs/$songId',
        params: { songId: String(update.localId) },
      })
    } else if (update.entityType === 'schedule') {
      navigate({
        to: '/schedules/$scheduleId',
        params: { scheduleId: String(update.localId) },
      })
    }
  }

  const isNavigable = (update: SyncUpdate) =>
    update.localId !== null &&
    (update.entityType === 'song' || update.entityType === 'schedule')

  return (
    <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
          {t('sections.sync.changes.received')}
        </h4>
        {hasUnseen && (
          <button
            type="button"
            onClick={() => markSeenMutation.mutate(undefined)}
            disabled={markSeenMutation.isPending}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
          >
            {markSeenMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            {t('sections.sync.changes.markAllSeen')}
          </button>
        )}
      </div>
      {displayed.length === 0 ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <Inbox className="h-3.5 w-3.5" />
          {t('sections.sync.changes.receivedEmpty')}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
          {displayed.map((update) => {
            const navigable = isNavigable(update)
            const row = (
              <>
                <SyncChangeKindBadge changeKind={update.changeKind} />
                {!update.seen && (
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500"
                  />
                )}
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    update.seen
                      ? 'text-gray-700 dark:text-gray-300'
                      : 'font-medium text-gray-900 dark:text-white'
                  }`}
                >
                  {update.title}
                </span>
                <span className="hidden flex-shrink-0 text-xs text-gray-500 sm:inline dark:text-gray-400">
                  {update.sourceDevice
                    ? t('sections.sync.changes.onDevice', {
                        device: update.sourceDevice,
                      })
                    : ''}
                </span>
                <span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                  {formatRelativeTime(update.occurredAt * 1000, i18n.language)}
                </span>
              </>
            )
            return (
              <li key={update.id}>
                {navigable ? (
                  <button
                    type="button"
                    onClick={() => openEntity(update)}
                    className="flex w-full items-center gap-2 rounded-md py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50"
                  >
                    {row}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 py-1.5">{row}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
