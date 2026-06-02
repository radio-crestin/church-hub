import { Link } from '@tanstack/react-router'
import { ChevronUp, LogOut, User as UserIcon } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { getLogoutRedirectUrl } from '~/features/users/service'
import { usePermissions } from '~/provider/permissions-provider'
import { UserAvatar } from './UserAvatar'

interface CurrentUserButtonProps {
  isCollapsed: boolean
}

const PANEL_WIDTH = 288 // w-72
const PANEL_GAP = 8 // mb-2 equivalent

/**
 * Sidebar account button that opens a small dropdown — user info, a link to
 * the account page and Log out. Switching account is done from the picker
 * after signing out.
 *
 * The dropdown is rendered through a portal with fixed positioning so it
 * floats above the sidebar regardless of overflow / width constraints (the
 * surrounding `<nav>` has `overflow-y-auto` and the collapsed sidebar is
 * only 80px wide, which would otherwise clip a 288px panel).
 */
export function CurrentUserButton({ isCollapsed }: CurrentUserButtonProps) {
  const { t } = useTranslation('users')
  const { userName, isApp, isAuthenticated } = usePermissions()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  )

  // Recompute panel position whenever it opens, on resize, or on scroll.
  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      // Anchor the panel's bottom-left just above the trigger. Clamp into the
      // viewport so the collapsed-sidebar case (very narrow trigger) still
      // shows the whole panel.
      const left = Math.max(
        8,
        Math.min(r.left, window.innerWidth - PANEL_WIDTH - 8),
      )
      setCoords({ top: r.top - PANEL_GAP, left })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

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

  const panel = open && coords && (
    <>
      {/* Click-outside backdrop */}
      <div
        className="fixed inset-0 z-[60]"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Dropdown panel — fixed-positioned so it floats above the sidebar
          and ignores the nav's `overflow-y-auto`. `translateY(-100%)` lifts
          it above the trigger (we anchored `top` to the trigger's top). */}
      <div
        className="fixed z-[61] w-72 -translate-y-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl"
        style={{ top: coords.top, left: coords.left }}
        role="menu"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-200 dark:border-gray-700">
          <UserAvatar name={displayName} isSuperAdmin={isApp} size="md" />
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
            <ChevronUp
              className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${open ? '' : 'rotate-180'}`}
            />
          </>
        )}
      </button>

      {panel && createPortal(panel, document.body)}
    </div>
  )
}
