import { Link } from '@tanstack/react-router'
import {
  AlertCircle,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogOut,
  User as UserIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useLocalUsers } from '~/features/users/hooks'
import {
  getLoginRedirectUrl,
  getLogoutRedirectUrl,
  login,
} from '~/features/users/service'
import type { LocalUser } from '~/features/users/types'
import { usePermissions } from '~/provider/permissions-provider'
import { UserAvatar } from './UserAvatar'

interface CurrentUserButtonProps {
  isCollapsed: boolean
}

/**
 * Sidebar account button that opens a dropdown menu — current user info,
 * a link to the account page, quick-switch to another account (passwordless
 * is instant, password-protected accounts get an inline prompt), and Log out.
 */
export function CurrentUserButton({ isCollapsed }: CurrentUserButtonProps) {
  const { t } = useTranslation('users')
  const { userName, userId, isApp, isAuthenticated } = usePermissions()
  const { data: localUsers } = useLocalUsers()

  const [open, setOpen] = useState(false)
  const [passwordTarget, setPasswordTarget] = useState<LocalUser | null>(null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(false)

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setPasswordTarget(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!isAuthenticated) return null

  const displayName = userName ?? t('profile.user')
  const roleLabel = isApp ? t('superAdmin') : t('profile.user')
  const otherUsers = (localUsers ?? []).filter((u) => u.id !== userId)

  function closeMenu() {
    setOpen(false)
    setPasswordTarget(null)
    setPassword('')
    setShowPassword(false)
    setError(false)
  }

  async function quickSwitch(user: LocalUser, pw?: string) {
    setSubmitting(true)
    setError(false)
    try {
      const result = await login(user.id, pw)
      window.location.href = getLoginRedirectUrl(result.ticket)
    } catch {
      setError(true)
      setSubmitting(false)
    }
  }

  function handleSwitchClick(user: LocalUser) {
    if (user.hasPassword) {
      setPasswordTarget(user)
      setPassword('')
      setShowPassword(false)
      setError(false)
    } else {
      void quickSwitch(user)
    }
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (passwordTarget) void quickSwitch(passwordTarget, password)
  }

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
            onClick={closeMenu}
            aria-hidden="true"
          />

          {/* Dropdown panel */}
          <div className="absolute bottom-full mb-2 left-0 z-50 w-72 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl">
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
                onClick={closeMenu}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <UserIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                {t('profile.title')}
              </Link>
            </div>

            {/* Quick switch */}
            {otherUsers.length > 0 && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700" />
                <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {t('switchUser')}
                </p>
                <ul className="p-1.5 pt-0">
                  {otherUsers.map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        onClick={() => handleSwitchClick(user)}
                        disabled={submitting}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60 ${
                          passwordTarget?.id === user.id
                            ? 'bg-gray-50 dark:bg-gray-700/50'
                            : ''
                        }`}
                      >
                        <UserAvatar
                          name={user.name}
                          isSuperAdmin={user.isSuperAdmin}
                          size="sm"
                        />
                        <span className="flex-1 min-w-0 truncate font-medium">
                          {user.name}
                        </span>
                        {user.hasPassword && (
                          <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        )}
                      </button>

                      {/* Inline password prompt for password-protected user */}
                      {passwordTarget?.id === user.id && (
                        <form
                          onSubmit={handlePasswordSubmit}
                          className="mx-2 mb-1.5 mt-1 space-y-2 rounded-lg bg-gray-50 p-2.5 dark:bg-gray-900/40"
                        >
                          <div className="relative">
                            <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                            <input
                              type={showPassword ? 'text' : 'password'}
                              autoFocus
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value)
                                setError(false)
                              }}
                              disabled={submitting}
                              placeholder={t('login.passwordPlaceholder')}
                              className={`w-full rounded-md border bg-white py-1.5 pl-8 pr-9 text-sm text-gray-900 outline-none transition focus:ring-2 disabled:opacity-60 dark:bg-gray-700 dark:text-white ${
                                error
                                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500/30'
                                  : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/30 dark:border-gray-600'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((s) => !s)}
                              tabIndex={-1}
                              aria-label={
                                showPassword
                                  ? t('password.hide')
                                  : t('password.show')
                              }
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                            >
                              {showPassword ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                          {error && (
                            <p
                              role="alert"
                              className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400"
                            >
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              {t('login.wrongPassword')}
                            </p>
                          )}
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setPasswordTarget(null)
                                setPassword('')
                                setError(false)
                              }}
                              disabled={submitting}
                              className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                            >
                              {t('login.back')}
                            </button>
                            <button
                              type="submit"
                              disabled={submitting || password.length === 0}
                              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                            >
                              {submitting && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                              {t('login.signIn')}
                            </button>
                          </div>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}

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
