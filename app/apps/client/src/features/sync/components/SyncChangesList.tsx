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
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-fg">
          {t('sections.sync.changes.received')}
        </h4>
        {hasUnseen && (
          <button
            type="button"
            onClick={() => markSeenMutation.mutate(undefined)}
            disabled={markSeenMutation.isPending}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-fg-label hover:bg-hover hover:text-fg disabled:opacity-50"
          >
            {markSeenMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck strokeWidth={1.75} className="h-3.5 w-3.5" />
            )}
            {t('sections.sync.changes.markAllSeen')}
          </button>
        )}
      </div>
      {displayed.length === 0 ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-hint">
          <Inbox strokeWidth={1.75} className="h-3.5 w-3.5" />
          {t('sections.sync.changes.receivedEmpty')}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {displayed.map((update) => {
            const navigable = isNavigable(update)
            const row = (
              <>
                <SyncChangeKindBadge changeKind={update.changeKind} />
                {!update.seen && (
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary"
                  />
                )}
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    update.seen ? 'text-fg-body' : 'font-medium text-fg'
                  }`}
                >
                  {update.title}
                </span>
                <span className="hidden flex-shrink-0 text-xs text-fg-hint sm:inline">
                  {update.sourceDevice
                    ? t('sections.sync.changes.onDevice', {
                        device: update.sourceDevice,
                      })
                    : ''}
                </span>
                <span className="flex-shrink-0 text-xs text-fg-hint">
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
                    className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-hover"
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
