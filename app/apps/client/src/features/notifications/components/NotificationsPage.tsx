import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SongCheckingNotification } from '~/features/song-discovery/components/SongCheckingNotification'
import { NotificationItem } from './NotificationItem'
import { useNotificationHistory } from '../hooks/useNotificationHistory'
import type { AppNotification } from '../service/notificationsApi'
import { groupByDay } from '../utils/groupByDay'

/**
 * Every notification of the last 60 days, newest first, by day. Opening it
 * reads them: those unread until now stay marked as new while it is open.
 */
export function NotificationsPage() {
  const { t, i18n } = useTranslation('notifications')
  const { notifications, isLoading, markAllRead, remove } =
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('description')}
        </p>
      </header>

      <SongCheckingNotification />

      {!isLoading && notifications.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 px-6 py-12 text-center dark:border-gray-700">
          <Bell className="h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="font-medium text-gray-700 dark:text-gray-200">
            {t('empty')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('emptyHint')}
          </p>
        </div>
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
    </div>
  )
}
