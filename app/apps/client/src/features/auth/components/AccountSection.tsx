import { useQueryClient } from '@tanstack/react-query'
import { Check, LogOut, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { performLogout } from '~/features/users/service'
import { PERMISSION_GROUPS, type PermissionGroup } from '~/features/users/types'
import { usePermissions } from '~/provider/permissions-provider'
import { captureActivity } from '~/utils/activity-logger'
import { UserAvatar } from './UserAvatar'

const GROUP_ORDER: PermissionGroup[] = [
  'songs',
  'bible',
  'control_room',
  'programs',
  'queue',
  'song_key',
  'settings',
  'logs',
  'displays',
  'users',
]

/**
 * The signed-in user's own account view — profile, permissions and a log out
 * action. Rendered as a section inside Settings → Users (it no longer has a
 * dedicated /account page). Switching account is done from the sidebar account
 * dropdown.
 */
export function AccountSection() {
  const { t } = useTranslation(['users', 'settings'])
  const { userName, permissions, isApp, isAdmin, refresh } = usePermissions()
  const queryClient = useQueryClient()

  const hasFullAccess = isApp || isAdmin
  const displayName = userName ?? t('profile.user')

  // Logout via fetch + context refresh (no page navigation, which is
  // unreliable in the packaged desktop webview).
  const handleLogout = async () => {
    captureActivity('logout', { source: 'settings-account' })
    await performLogout()
    queryClient.clear()
    await refresh()
  }

  return (
    <div className="space-y-5">
      {/* Header: avatar, name, role and a log out action. */}
      <div className="flex items-center gap-4">
        <UserAvatar name={displayName} isSuperAdmin={isApp} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-fg">
            {displayName}
          </h3>
          <p className="text-sm text-fg-hint">
            {isApp ? t('superAdmin') : t('profile.user')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg bg-field px-3 text-sm font-medium text-red-600 transition-colors hover:bg-hover dark:text-red-400"
        >
          <LogOut strokeWidth={1.5} className="h-4 w-4" />
          <span className="hidden sm:inline">{t('logout')}</span>
        </button>
      </div>

      {/* Permissions */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-fg">
          {t('profile.permissions')}
        </h4>
        {hasFullAccess ? (
          <div className="flex items-center gap-2 rounded-lg bg-field p-3 text-sm text-fg-body">
            <ShieldCheck
              strokeWidth={1.5}
              className="h-4 w-4 shrink-0 text-fg-label"
            />
            {t('profile.fullAccess')}
          </div>
        ) : permissions.length === 0 ? (
          <p className="text-sm text-fg-hint">{t('profile.noPermissions')}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {GROUP_ORDER.map((group) => {
              const granted = PERMISSION_GROUPS[group].filter((p) =>
                permissions.includes(p),
              )
              if (granted.length === 0) return null
              return (
                <div key={group}>
                  <p className="mb-1.5 text-xs font-medium text-fg-hint">
                    {t(`settings:sections.users.groups.${group}`)}
                  </p>
                  <ul className="space-y-1">
                    {granted.map((permission) => (
                      <li
                        key={permission}
                        className="flex items-center gap-2 text-sm text-fg-body"
                      >
                        <Check
                          strokeWidth={1.5}
                          className="h-4 w-4 shrink-0 text-ok"
                        />
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
    </div>
  )
}
