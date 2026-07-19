import type { LucideIcon } from 'lucide-react'
import {
  CalendarDays,
  CheckCircle2,
  FolderOpen,
  Music,
  Tag,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useSyncPending } from '../hooks/useSyncPending'
import type { SyncEntityType } from '../service'
import { formatRelativeTime } from '../utils/formatRelativeTime'

const ENTITY_ICONS: Record<SyncEntityType, LucideIcon> = {
  song: Music,
  song_category: Tag,
  song_group: FolderOpen,
  schedule: CalendarDays,
}

/**
 * "To send from this computer": local changes queued for upload to Drive.
 * Polls alongside the status query and is invalidated by the `sync_applied`
 * WebSocket event and the Sync now mutation (both touch the `['sync']` prefix).
 */
export function SyncPendingList() {
  const { t, i18n } = useTranslation('settings')
  const { data: pending } = useSyncPending()

  return (
    <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
        {t('sections.sync.changes.toSend')}
      </h4>
      {!pending || pending.length === 0 ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          {t('sections.sync.changes.empty')}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
          {pending.map((entry) => {
            const Icon = ENTITY_ICONS[entry.entityType]
            return (
              <li
                key={`${entry.entityType}:${entry.entityUuid}`}
                className="flex items-center gap-2 py-1.5"
              >
                <span
                  title={t(`sections.sync.changes.entity.${entry.entityType}`)}
                  className="flex-shrink-0 text-gray-400"
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-white">
                  {entry.title}
                </span>
                <span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                  {formatRelativeTime(entry.queuedAt * 1000, i18n.language)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
