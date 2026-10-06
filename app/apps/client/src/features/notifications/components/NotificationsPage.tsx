import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SongCheckingNotification } from '~/features/song-discovery/components/SongCheckingNotification'
import { EmptyState, Page, PageHeader, PagePanel } from '~/ui/page'
import { NotificationItem } from './NotificationItem'
import { NotificationsPageActions } from './NotificationsPageActions'
import { useNotificationHistory } from '../hooks/useNotificationHistory'
import type { AppNotification } from '../service/notificationsApi'
import { groupByDay } from '../utils/groupByDay'

/**
 * Every notification of the last 60 days, newest first, by day. Opening it
 * reads them: those unread until now stay marked as new while it is open, or
 * until "Mark all as read".
 */
export function NotificationsPage() {
  const { t, i18n } = useTranslation('notifications')
  const { notifications, isLoading, markAllRead, remove, removeAll } =
    useNotificationHistory()
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  const unreadIds = notifications
    .filter((n) => n.readAt === null)
    .map((n) => n.id)
    .join('\n')
  useEffect(() => {
    if (!unreadIds) return
    setNewIds((ids) => new Set([...ids, ...unreadIds.split('\n')]))
    markAllRead()
  }, [unreadIds, markAllRead])

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
            hasNew={newIds.size > 0 || unreadIds !== ''}
            isEmpty={notifications.length === 0}
            onMarkAllRead={() => {
              markAllRead()
              setNewIds(new Set())
            }}
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
            {items.map((notification: AppNotification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                isNew={newIds.has(notification.id)}
                onClose={() => remove(notification.id)}
                closeLabel={t('remove')}
              />
            ))}
          </section>
        ))}
      </PagePanel>
    </Page>
  )
}
