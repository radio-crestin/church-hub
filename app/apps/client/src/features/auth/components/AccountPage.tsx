import { Check, LogOut, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { getLogoutRedirectUrl } from '~/features/users/service'
import { PERMISSION_GROUPS, type PermissionGroup } from '~/features/users/types'
import { usePermissions } from '~/provider/permissions-provider'
import { UserAvatar } from './UserAvatar'

const GROUP_ORDER: PermissionGroup[] = [
  'songs',
  'bible',
  'control_room',
  'programs',
  'queue',
  'song_key',
  'settings',
  'displays',
  'users',
]

/**
 * Full-page account view (replaces the current page content). Shows the
 * signed-in user and their permissions, and lets them log out. Switching
 * account is done by logging out and signing back in as someone else.
 */
export function AccountPage() {
  const { t } = useTranslation(['users', 'settings'])
  const { userName, permissions, isApp, isAdmin } = usePermissions()

  const hasFullAccess = isApp || isAdmin

  const handleLogout = () => {
    window.location.href = getLogoutRedirectUrl()
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <UserAvatar
          name={userName ?? t('profile.user')}
          isSuperAdmin={isApp}
          size="lg"
        />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-gray-900 dark:text-white">
            {userName ?? t('profile.user')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isApp ? t('superAdmin') : t('profile.user')}
          </p>
        </div>
      </div>

      {/* Permissions */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          {t('profile.permissions')}
        </h2>
        {hasFullAccess ? (
          <div className="flex items-center gap-2 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300">
            <ShieldCheck className="h-5 w-5 shrink-0" />
            {t('profile.fullAccess')}
          </div>
        ) : permissions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('profile.noPermissions')}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {GROUP_ORDER.map((group) => {
              const granted = PERMISSION_GROUPS[group].filter((p) =>
                permissions.includes(p),
              )
              if (granted.length === 0) return null
              return (
                <div key={group}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {t(`settings:sections.users.groups.${group}`)}
                  </p>
                  <ul className="space-y-1">
                    {granted.map((permission) => (
                      <li
                        key={permission}
                        className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                      >
                        <Check className="h-4 w-4 shrink-0 text-green-500" />
                        {t(
                          `settings:sections.users.permissionLabels.${permission}`,
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Log out — to switch account, log out and sign in as someone else. */}
      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-red-700 sm:w-auto"
      >
        <LogOut className="h-4 w-4" />
        {t('logout')}
      </button>
    </div>
  )
}
