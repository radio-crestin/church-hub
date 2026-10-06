import { useNavigate } from '@tanstack/react-router'
import { Download, ListChecks, Music, Settings2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { NotificationAction } from '~/features/notifications/components/NotificationAction'
import { NotificationShell } from '~/features/notifications/components/NotificationShell'
import type { AppNotification } from '~/features/notifications/service/notificationsApi'
import { useToast } from '~/ui/toast'
import { SongRefList } from './SongRefList'
import { useSongUpdates } from '../hooks/useSongUpdates'
import type { SongSyncData } from '../service/songUpdatesApi'

interface SongSyncNotificationProps {
  notification: AppNotification
  isNew: boolean
  onClose?: () => void
  closeLabel?: string
  /** After the user opened or did something from it. */
  onActed?: () => void
  /** Without the songs by title (the pop-up). */
  compact?: boolean
}

/**
 * What the song sync added and updated (songs-synced), or what waits for
 * the user's approval (songs-pending), with the songs by title, per source.
 * Waiting songs sync from here with one click.
 */
export function SongSyncNotification({
  notification,
  isNew,
  onClose,
  closeLabel,
  onActed,
  compact = false,
}: SongSyncNotificationProps) {
  const { t } = useTranslation('songDiscovery')
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { syncPending, isSyncing, isRunning } = useSongUpdates()
  const isPending = notification.kind === 'songs-pending'
  const { sources } = notification.data as SongSyncData

  const added = sources.reduce((sum, s) => sum + s.added.count, 0)
  const updated = sources.reduce((sum, s) => sum + s.updated.count, 0)
  const summary = [
    added > 0 &&
      t(isPending ? 'notification.toAdd' : 'notification.added', {
        count: added,
      }),
    updated > 0 &&
      t(isPending ? 'notification.toUpdate' : 'notification.updated', {
        count: updated,
      }),
  ]
    .filter(Boolean)
    .join(' · ')

  const go = (to: '/songs/discover' | '/settings/songs') => {
    void navigate({ to })
    onActed?.()
  }
  const syncNow = async () => {
    try {
      await syncPending()
      showToast(
        t('notification.syncDone', { count: added + updated }),
        'success',
      )
      onActed?.()
    } catch (error) {
      showToast(t('notification.syncFailed', { error: String(error) }), 'error')
    }
  }

  return (
    <NotificationShell
      testId={`notification-${notification.kind}`}
      icon={isPending ? Download : Music}
      tone={isPending ? 'amber' : 'indigo'}
      title={t(
        isPending ? 'notification.pendingTitle' : 'notification.syncedTitle',
      )}
      description={summary}
      createdAt={notification.createdAt}
      isNew={isNew}
      onClose={onClose}
      closeLabel={closeLabel}
      actions={
        isPending && (
          <>
            <NotificationAction
              primary
              icon={Download}
              onClick={() => void syncNow()}
              disabled={isSyncing || isRunning}
              testId="notification-sync-now"
            >
              {t('notification.syncNow')}
            </NotificationAction>
            <NotificationAction
              icon={ListChecks}
              onClick={() => go('/songs/discover')}
            >
              {t('notification.review')}
            </NotificationAction>
            <NotificationAction
              icon={Settings2}
              onClick={() => go('/settings/songs')}
            >
              {t('notification.syncSettings')}
            </NotificationAction>
          </>
        )
      }
    >
      {!compact && (
        <div className="flex flex-col gap-3">
          {sources.map((source) => (
            <section key={source.sourceId} className="flex flex-col gap-2">
              {sources.length > 1 && (
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {source.name}
                </h4>
              )}
              <SongRefList
                label={t(
                  isPending
                    ? 'notification.toAddList'
                    : 'notification.addedList',
                  {
                    count: source.added.count,
                    source: source.name,
                  },
                )}
                set={source.added}
                onOpen={onActed}
              />
              <SongRefList
                label={t(
                  isPending
                    ? 'notification.toUpdateList'
                    : 'notification.updatedList',
                  { count: source.updated.count, source: source.name },
                )}
                set={source.updated}
                onOpen={onActed}
              />
            </section>
          ))}
        </div>
      )}
    </NotificationShell>
  )
}
