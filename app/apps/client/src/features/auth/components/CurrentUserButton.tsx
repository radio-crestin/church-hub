import { Link } from '@tanstack/react-router'
import { ChevronUp, LogOut, User as UserIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getLogoutRedirectUrl } from '~/features/users/service'
import { usePermissions } from '~/provider/permissions-provider'
import { UserAvatar } from './UserAvatar'

interface CurrentUserButtonProps {
  isCollapsed: boolean
}

/**
 * Sidebar account button that opens a small dropdown — user info, a link to
 * the account page and Log out. Switching account is done from the picker
 * after signing out.
 */
export function CurrentUserButton({ isCollapsed }: CurrentUserButtonProps) {
  const { t } = useTranslation('users')
  const { userName, isApp, isAuthenticated } = usePermissions()
  const [open, setOpen] = useState(false)

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!isAuthenticated) return null

  const displayName = userName ?? t('profile.user')
  const roleLabel = isApp ? t('superAdmin') : t('profile.user')

  function handleLogout() {
    window.location.href = getLogoutRedirectUrl()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all w-full text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 ${open ? 'bg-gray-100 dark:bg-gray-800' : ''} ${isCollapsed ? 'md:justify-center' : ''}`}
        title={isCollapsed ? displayName : undefined}
        aria-label={t('profile.title')}
        aria-expanded={open}
      >
        <UserAvatar name={displayName} isSuperAdmin={isApp} size="sm" />
        <span className="flex-1 min-w-0 text-left md:hidden">
          <span className="block truncate text-sm font-medium">
            {displayName}
          </span>
        </span>
        {!isCollapsed && (
          <>
            <span className="hidden flex-1 min-w-0 text-left md:block">
              <span className="block truncate text-sm font-medium">
                {displayName}
              </span>
              <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                {roleLabel}
              </span>
            </span>
            <ChevronUp
              className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${open ? '' : 'rotate-180'}`}
            />
          </>
        )}
      </button>

      {open && (
        <>
          {/* Click-outside backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Dropdown panel */}
          <div className="absolute bottom-full mb-2 left-0 z-50 w-72 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-200 dark:border-gray-700">
              <UserAvatar
                name={displayName}
                isSuperAdmin={isApp}
                size="md"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {displayName}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {roleLabel}
                </p>
              </div>
            </div>

            {/* Account link */}
            <div className="p-1.5">
              <Link
                to="/account"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <UserIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                {t('profile.title')}
              </Link>
            </div>

            {/* Log out */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-1.5">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <LogOut className="h-4 w-4" />
                {t('logout')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
