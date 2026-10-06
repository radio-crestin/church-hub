import { Bell } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { SongCheckingNotification } from '~/features/song-discovery/components/SongCheckingNotification'
import { EmptyState, Page, PageHeader, PagePanel } from '~/ui/page'
import { NotificationItem } from './NotificationItem'
import { NotificationsPageActions } from './NotificationsPageActions'
import { useNotificationHistory } from '../hooks/useNotificationHistory'
import { markSeen } from '../seenNotifications'
import type { AppNotification } from '../service/notificationsApi'
import { groupByDay } from '../utils/groupByDay'

/**
 * Every notification of the last 60 days, newest first, by day. One stays
 * new (and the bell's dot on) until it is clicked, or "Mark all as read".
 */
export function NotificationsPage() {
  const { t, i18n } = useTranslation('notifications')
  const { notifications, isLoading, markAllRead, markRead, remove, removeAll } =
    useNotificationHistory()

  // Shown here, so they need not pop up later; still unread until clicked.
  useEffect(() => {
    for (const { id } of notifications) markSeen(id)
  }, [notifications])

  const days = groupByDay(notifications, i18n.language, {
    today: t('today'),
    yesterday: t('yesterday'),
  })

  return (
    <Page testId="notifications-page">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <NotificationsPageActions
            hasNew={notifications.some((n) => n.readAt === null)}
            isEmpty={notifications.length === 0}
            onMarkAllRead={markAllRead}
            onClearAll={removeAll}
          />
        }
      />
      <PagePanel testId="notifications-panel">
        <SongCheckingNotification />

        {!isLoading && notifications.length === 0 && (
          <EmptyState icon={Bell} title={t('empty')} hint={t('emptyHint')} />
        )}

        {days.map(({ label, items }) => (
          <section key={label} className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
              {label}
            </h2>
            {items.map((notification: AppNotification) => {
              const isNew = notification.readAt === null
              return (
                // A click anywhere on it (its links and buttons too) reads it.
                <div
                  key={notification.id}
                  className={isNew ? 'cursor-pointer' : undefined}
                  onClick={isNew ? () => markRead(notification.id) : undefined}
                >
                  <NotificationItem
                    notification={notification}
                    isNew={isNew}
                    onClose={() => remove(notification.id)}
                    closeLabel={t('remove')}
                  />
                </div>
              )
            })}
          </section>
        ))}
      </PagePanel>
    </Page>
  )
}
