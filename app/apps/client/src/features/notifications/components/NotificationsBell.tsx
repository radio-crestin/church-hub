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
      ? 'bg-selected text-fg'
      : 'text-fg-label hover:bg-hover hover:text-fg'

  return (
    <>
      <Link
        to="/notifications"
        data-testid="sidebar-notifications-bell"
        aria-label={label}
        title={label}
        onClick={onClick}
        className={`relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${stateClasses}`}
      >
        <Bell size={18} strokeWidth={1.5} />
        {hasUnread && (
          <span
            data-testid="sidebar-notifications-dot"
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary ring-2 ring-panel"
          />
        )}
      </Link>
      <NotificationPopUp />
    </>
  )
}
