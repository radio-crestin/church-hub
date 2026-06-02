import {
  AlertCircle,
  ChevronsUpDown,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogOut,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import {
  getLocalUsers,
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

// The menu opens ABOVE the trigger, left-aligned with the sidebar so it reads
// as an extension of it. Its width tracks the sidebar's actual width
// (content-fit, min-w-56 = 14rem) but never drops below this floor — so even a
// collapsed 80px icon rail yields a comfortable panel.
const PANEL_MIN_WIDTH = 224 // 14rem, matches the sidebar's md:min-w-56
const PANEL_GAP = 8 // space between the trigger and the panel

/**
 * Sidebar account button that opens a dropdown to switch between the local
 * accounts on this device and to log out. Selecting another account signs in
 * immediately — passwordless accounts switch on click, password-protected
 * accounts reveal an inline password prompt first.
 *
 * The dropdown is rendered through a portal with fixed positioning so it floats
 * above the sidebar regardless of overflow / width constraints (the surrounding
 * `<nav>` has `overflow-y-auto` and the collapsed sidebar is only 80px wide,
 * which would otherwise clip the panel).
 */
export function CurrentUserButton({ isCollapsed }: CurrentUserButtonProps) {
  const { t } = useTranslation('users')
  const { userId, userName, isApp, isAuthenticated } = usePermissions()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{
    bottom: number
    left: number
    width: number
  } | null>(null)

  // Other accounts available to switch into (everyone but the current user).
  const [accounts, setAccounts] = useState<LocalUser[] | null>(null)
  // The account chosen for a password-protected switch (inline prompt).
  const [selected, setSelected] = useState<LocalUser | null>(null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Load the account list each time the dropdown opens; clear it on close so a
  // freshly created/removed account is reflected next time.
  useEffect(() => {
    if (!open) {
      setAccounts(null)
      setSelected(null)
      setPassword('')
      setShowPassword(false)
      setError(false)
      setSubmitting(false)
      return
    }
    let cancelled = false
    getLocalUsers()
      .then((list) => {
        if (!cancelled) setAccounts(list.filter((u) => u.id !== userId))
      })
      .catch(() => {
        if (!cancelled) setAccounts([])
      })
    return () => {
      cancelled = true
    }
  }, [open, userId])

  // Recompute panel position whenever it opens, on resize, or on scroll.
  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      // Match the sidebar's current (content-fit) width, never below the floor
      // so a collapsed icon rail still yields a usable panel.
      const sidebarWidth = el.closest('aside')?.getBoundingClientRect().width
      const width = Math.max(sidebarWidth ?? 0, PANEL_MIN_WIDTH)
      // Open above the trigger, left-aligned with it, clamped into the viewport.
      // Anchoring by `bottom` (just above the trigger's top) lets the panel grow
      // upward as its content gets taller.
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
      const bottom = window.innerHeight - r.top + PANEL_GAP
      setCoords({ bottom, left, width })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  // Close on Escape (or step back from the password prompt first).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (selected) setSelected(null)
      else setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, selected])

  if (!isAuthenticated) return null

  const displayName = userName ?? t('profile.user')
  const roleLabel = isApp ? t('superAdmin') : t('profile.user')

  function handleLogout() {
    window.location.href = getLogoutRedirectUrl()
  }

  // Finalize a switch with a top-level navigation — the 302 reliably sets the
  // session cookie in the desktop webview and reloads the app as the new user.
  async function switchTo(user: LocalUser, pw?: string) {
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

  function handleSelect(user: LocalUser) {
    setError(false)
    setPassword('')
    setShowPassword(false)
    if (user.hasPassword) {
      setSelected(user)
    } else {
      void switchTo(user)
    }
  }

  function handleSubmitPassword(e: React.FormEvent) {
    e.preventDefault()
    if (selected) void switchTo(selected, password)
  }

  const panel = open && coords && (
    <>
      {/* Click-outside backdrop */}
      <div
        className="fixed inset-0 z-[60]"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Menu panel — fixed-positioned so it floats above the sidebar and
          ignores the nav's `overflow-y-auto`. Opens above the trigger,
          left-aligned with it. */}
      <div
        ref={panelRef}
        className="fixed z-[61] overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1 shadow-lg"
        style={{
          bottom: coords.bottom,
          left: coords.left,
          width: coords.width,
        }}
        role="menu"
      >
        {/* Header — the signed-in user */}
        <div className="flex items-center gap-2 px-1.5 py-1.5">
          <UserAvatar name={displayName} isSuperAdmin={isApp} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {displayName}
            </p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              {roleLabel}
            </p>
          </div>
        </div>

        <div className="-mx-1 my-1 h-px bg-gray-200 dark:bg-gray-700" />

        {selected ? (
          /* Inline password prompt for a protected account */
          <form
            onSubmit={handleSubmitPassword}
            className="px-1.5 pb-1.5 pt-0.5"
          >
            <div className="mb-3 flex items-center gap-3">
              <UserAvatar
                name={selected.name}
                isSuperAdmin={selected.isSuperAdmin}
                size="sm"
              />
              <p className="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-white">
                {selected.name}
              </p>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
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
                aria-label={t('login.passwordLabel')}
                className={`w-full rounded-lg border bg-white py-2 pl-9 pr-9 text-sm text-gray-900 outline-none transition focus:ring-2 disabled:opacity-60 dark:bg-gray-900 dark:text-white ${
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
                  showPassword ? t('password.hide') : t('password.show')
                }
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {error ? (
              <p
                role="alert"
                className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {t('login.wrongPassword')}
              </p>
            ) : null}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                disabled={submitting}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {t('login.back')}
              </button>
              <button
                type="submit"
                disabled={submitting || password.length === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {t('login.signIn')}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Switch-user list */}
            {accounts === null ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            ) : accounts.length > 0 ? (
              <>
                <p className="px-1.5 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {t('switchUser')}
                </p>
                <ul className="max-h-64 space-y-0.5 overflow-y-auto scrollbar-thin">
                  {accounts.map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(user)}
                        disabled={submitting}
                        className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-60 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <UserAvatar
                          name={user.name}
                          isSuperAdmin={user.isSuperAdmin}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {user.name}
                        </span>
                        {user.hasPassword ? (
                          <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="-mx-1 my-1 h-px bg-gray-200 dark:bg-gray-700" />
              </>
            ) : null}

            {/* Log out */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <LogOut className="h-4 w-4" />
              {t('logout')}
            </button>
          </>
        )}
      </div>
    </>
  )

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all w-full text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 ${open ? 'bg-gray-100 dark:bg-gray-800' : ''} ${isCollapsed ? 'md:justify-center' : ''}`}
        title={isCollapsed ? displayName : undefined}
        aria-label={t('profile.title')}
        aria-expanded={open}
        aria-haspopup="menu"
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
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-400" />
          </>
        )}
      </button>

      {panel && createPortal(panel, document.body)}
    </div>
  )
}
