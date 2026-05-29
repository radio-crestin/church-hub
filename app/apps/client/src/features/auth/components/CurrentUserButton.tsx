import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { usePermissions } from '~/provider/permissions-provider'
import { UserAvatar } from './UserAvatar'

interface CurrentUserButtonProps {
  isCollapsed: boolean
}

/**
 * Sidebar row showing who is currently signed in. Navigates to the account
 * page (profile, permissions, switch user, log out) — replacing the current
 * page in the content area.
 */
export function CurrentUserButton({ isCollapsed }: CurrentUserButtonProps) {
  const { t } = useTranslation('users')
  const { userName, isApp, isAuthenticated } = usePermissions()

  if (!isAuthenticated) return null

  const displayName = userName ?? t('profile.user')

  return (
    <Link
      to="/account"
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all w-full text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 [&.active]:bg-gray-100 dark:[&.active]:bg-gray-800 ${isCollapsed ? 'md:justify-center' : ''}`}
      title={isCollapsed ? displayName : undefined}
      aria-label={t('profile.title')}
    >
      <UserAvatar name={displayName} isSuperAdmin={isApp} size="sm" />
      <span className="flex-1 min-w-0 text-left md:hidden">
        <span className="block truncate text-sm font-medium">
          {displayName}
        </span>
      </span>
      {!isCollapsed && (
        <span className="hidden flex-1 min-w-0 text-left md:block">
          <span className="block truncate text-sm font-medium">
            {displayName}
          </span>
          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
            {isApp ? t('superAdmin') : t('profile.user')}
          </span>
        </span>
      )}
    </Link>
  )
}
