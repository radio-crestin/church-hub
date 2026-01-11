import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'

import {
  openInBrowserTab,
  openPageInNativeWindow,
} from '~/features/sidebar-config/service'
import type { NativeWindowSettings } from '~/features/sidebar-config/types'
import { KeyboardShortcutBadge } from '~/ui/kbd'
import { isTauri } from '~/utils/isTauri'
import { createLogger } from '~/utils/logger'

const logger = createLogger('app:sidebar')

interface SidebarItemProps {
  icon: LucideIcon
  label: string
  to: string
  isCollapsed: boolean
  isActive: boolean
  className?: string
  disabled?: boolean
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
  shortcut?: string
  /** Page ID for window management */
  pageId: string
  /** Native window settings for this page */
  nativeWindowSettings?: NativeWindowSettings
  /** Icon name for custom pages (used for window icon) */
  iconName?: string
  /** External URL for custom pages (loaded directly in native window) */
  externalUrl?: string
}

export function SidebarItem({
  icon: Icon,
  label,
  to,
  isCollapsed,
  isActive,
  className = '',
  disabled = false,
  onClick,
  shortcut,
  pageId,
  nativeWindowSettings,
  iconName,
  externalUrl,
}: SidebarItemProps) {
  /**
   * Handle middle-click to open page in native window or new tab
   * Prevents default behavior and stops propagation to avoid navigation
   */
  const handleAuxClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Only handle middle button (button === 1)
    if (e.button !== 1) return

    logger.debug(`Middle-click on ${pageId}, preventing navigation`)
    e.preventDefault()
    e.stopPropagation()

    // Check if native window is enabled for this page
    if (isTauri() && nativeWindowSettings?.openInNativeWindow) {
      logger.debug(`Opening ${pageId} in native window`)
      void openPageInNativeWindow(pageId, label, to, iconName, externalUrl)
    } else {
      // Browser mode or native window not enabled: open in new tab
      logger.debug(`Opening ${pageId} in browser tab`)
      // For external URLs, open them directly
      if (externalUrl) {
        window.open(externalUrl, '_blank')
      } else {
        openInBrowserTab(to)
      }
    }
  }

  /**
   * Handle mousedown to prevent middle-click from triggering navigation
   */
  const handleMouseDown = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Prevent middle-click from triggering any default link behavior
    if (e.button === 1) {
      logger.debug(`Middle mousedown on ${pageId}, preventing default`)
      e.preventDefault()
      e.stopPropagation()
    }
  }

  /**
   * Handle mouseup to prevent middle-click from triggering navigation
   */
  const handleMouseUp = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Prevent middle-click from triggering any default link behavior
    if (e.button === 1) {
      logger.debug(`Middle mouseup on ${pageId}, preventing default`)
      e.preventDefault()
      e.stopPropagation()
    }
  }

  /**
   * Handle click - only process left-click, ignore middle-click
   * If forceNativeWindow is enabled, open in native window instead of navigating
   */
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Middle-click should not trigger onClick navigation
    if (e.button === 1) {
      logger.debug(`Middle-click in onClick on ${pageId}, blocking`)
      e.preventDefault()
      e.stopPropagation()
      return
    }

    // If force native window is enabled, intercept left-click and open in native window
    if (isTauri() && nativeWindowSettings?.forceNativeWindow) {
      logger.debug(
        `Force native window enabled for ${pageId}, opening in native window`,
      )
      e.preventDefault()
      e.stopPropagation()
      void openPageInNativeWindow(pageId, label, to, iconName, externalUrl)
      return
    }

    // Call parent's onClick handler for left-click
    onClick?.(e)
  }
  const baseClasses = `
    flex items-center gap-3 px-4 py-3 rounded-lg transition-all
    ${isCollapsed ? 'md:justify-center' : ''}
    ${className}
  `

  const enabledClasses = isActive
    ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'

  const disabledClasses =
    'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-600'

  const content = (
    <>
      <Icon size={20} className="flex-shrink-0" />
      {/* Mobile: always show label, Desktop: respect isCollapsed */}
      <span className="text-sm font-medium md:hidden">{label}</span>
      {!isCollapsed && (
        <span className="text-sm font-medium hidden md:inline flex-1">
          {label}
        </span>
      )}
      {shortcut && !isCollapsed && (
        <KeyboardShortcutBadge
          shortcut={shortcut}
          variant="muted"
          className="hidden md:inline-block ml-auto"
        />
      )}
    </>
  )

  if (disabled) {
    return (
      <div
        className={`${baseClasses} ${disabledClasses}`}
        title={isCollapsed ? label : undefined}
      >
        {content}
      </div>
    )
  }

  return (
    <Link
      to={to}
      className={`${baseClasses} ${enabledClasses}`}
      title={isCollapsed ? label : undefined}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onAuxClick={handleAuxClick}
    >
      {content}
    </Link>
  )
}
