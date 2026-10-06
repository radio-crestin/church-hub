import { Link, useLocation } from '@tanstack/react-router'
import { Bell } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { NotificationPopUp } from './NotificationPopUp'
import { useNotificationHistory } from '../hooks/useNotificationHistory'
import { useRecordAppUpdate } from '../hooks/useRecordAppUpdate'

interface NotificationsBellProps {
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void
}

/**
 * The bell next to Settings in the sidebar, with a dot while something is
 * unread; it opens the notifications page. Also where new notifications pop
 * up from.
 */
export function NotificationsBell({ onClick }: NotificationsBellProps) {
  const { t } = useTranslation('sidebar')
  const { pathname } = useLocation()
  const { unreadCount } = useNotificationHistory()
  useRecordAppUpdate()

  const hasUnread = unreadCount > 0
  const label = hasUnread ? t('notifications.unread') : t('notifications.title')
  const stateClasses =
    pathname === '/notifications'
      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200'

  return (
    <>
      <Link
        to="/notifications"
        data-testid="sidebar-notifications-bell"
        aria-label={label}
        title={label}
        onClick={onClick}
        className={`relative flex-shrink-0 self-center p-3 rounded-lg transition-colors ${stateClasses}`}
      >
        <Bell size={20} />
        {hasUnread && (
          <span
            data-testid="sidebar-notifications-dot"
            className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900"
          />
        )}
      </Link>
      <NotificationPopUp />
    </>
  )
}
