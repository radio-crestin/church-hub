import { useLocation } from '@tanstack/react-router'
import { Bell } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type { IconColor } from '~/features/sidebar-config/types'
import { SidebarItem } from '~/ui/sidebar/sidebar-item'
import { NotificationPopUp } from './NotificationPopUp'
import { useNotificationHistory } from '../hooks/useNotificationHistory'
import { useRecordAppUpdate } from '../hooks/useRecordAppUpdate'

interface NotificationsSidebarItemProps {
  isCollapsed: boolean
  iconColor?: IconColor
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void
}

/**
 * "Notifications" in the sidebar, like Settings, with the unread count; it
 * opens the notifications page. Also where new notifications pop up from.
 */
export function NotificationsSidebarItem({
  isCollapsed,
  iconColor,
  onClick,
}: NotificationsSidebarItemProps) {
  const { t } = useTranslation('sidebar')
  const { pathname } = useLocation()
  const { unreadCount } = useNotificationHistory()
  useRecordAppUpdate()

  return (
    <>
      <SidebarItem
        pageId="notifications"
        icon={Bell}
        label={t('notifications.title')}
        to="/notifications"
        isCollapsed={isCollapsed}
        isActive={pathname === '/notifications'}
        className="md:flex"
        onClick={onClick}
        iconColor={iconColor}
        badgeCount={unreadCount}
      />
      <NotificationPopUp />
    </>
  )
}
