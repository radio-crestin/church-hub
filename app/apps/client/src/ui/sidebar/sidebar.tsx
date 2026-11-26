import { useLocation } from '@tanstack/react-router'
import {
  ChevronLeft,
  ChevronRight,
  MessageSquarePlus,
  Monitor,
  Settings,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SidebarHeader } from './sidebar-header'
import { SidebarItem } from './sidebar-item'
import { useSidebarCollapsed } from './use-sidebar-collapsed'
import { useSidebarItemClick } from './use-sidebar-item-click'
import { useSidebarMenuItems } from './use-sidebar-menu-items'
import { CurrentUserButton } from '../../features/auth'
import { RequestFeatureTool } from '../../features/feature-request'
import { useKioskSettings } from '../../features/kiosk'
import { NotificationsBell } from '../../features/notifications/components/NotificationsBell'
import {
  updateCurrentWebviewBounds,
  useSidebarConfig,
  useSidebarItemShortcuts,
} from '../../features/sidebar-config'
import type {
  CustomPageMenuItem,
  NativeWindowSettings,
} from '../../features/sidebar-config/types'
import { groupSidebarItems } from '../../features/sidebar-config/utils/sidebarGroups'
import { usePermissions } from '../../provider/permissions-provider'

interface SidebarProps {
  isMobileMenuOpen?: boolean
  onMobileMenuChange?: (open: boolean) => void
}

export function Sidebar({
  isMobileMenuOpen: externalMobileMenuOpen,
  onMobileMenuChange,
}: SidebarProps = {}) {
  const { isCollapsed, toggleCollapsed } = useSidebarCollapsed()
  const [internalMobileMenuOpen, setInternalMobileMenuOpen] = useState(false)
  const isMobileMenuOpen = externalMobileMenuOpen ?? internalMobileMenuOpen
  const setIsMobileMenuOpen = onMobileMenuChange ?? setInternalMobileMenuOpen
  const [isFeatureRequestOpen, setIsFeatureRequestOpen] = useState(false)
  const location = useLocation()
  // Defensive: /screen/* renders fullscreen via app-layout and never
  // mounts the sidebar. If something ever does mount it here (HMR race,
  // a future layout wrapper), this guard keeps the support surface off
  // projector windows. Hiding the button is non-negotiable for screens.
  const isScreenRoute = location.pathname.startsWith('/screen/')
  const { t } = useTranslation(['sidebar', 'common'])
  const { hasPermission } = usePermissions()

  // Get sidebar configuration
  const { config } = useSidebarConfig()

  // Get keyboard shortcuts for sidebar items from sidebar config
  const sidebarShortcuts = useSidebarItemShortcuts()

  // Map route paths to their configured shortcuts
  const routeShortcuts = useMemo(() => {
    const map: Record<string, string | undefined> = {}
    for (const s of sidebarShortcuts) {
      // Only use the first shortcut for each route
      if (!map[s.route]) {
        map[s.route] = s.shortcut
      }
    }
    return map
  }, [sidebarShortcuts])

  // Get native window settings and icon name for an item
  const getItemNativeWindowSettings = useCallback(
    (itemId: string): NativeWindowSettings | undefined => {
      const item = config?.items.find((i) => i.id === itemId)
      return item?.settings?.nativeWindow
    },
    [config],
  )

  const getItemIconName = useCallback(
    (itemId: string): string | undefined => {
      const item = config?.items.find((i) => i.id === itemId)
      if (item?.type === 'custom') {
        return (item as CustomPageMenuItem).iconName
      }
      return undefined
    },
    [config],
  )

  // Get external URL for custom pages (used for native windows)
  const getItemExternalUrl = useCallback(
    (itemId: string): string | undefined => {
      const item = config?.items.find((i) => i.id === itemId)
      if (item?.type === 'custom') {
        return (item as CustomPageMenuItem).url
      }
      return undefined
    },
    [config],
  )

  // Get kiosk settings to determine if kiosk menu item should be visible
  const { data: kioskSettings } = useKioskSettings()

  const menuItems = useSidebarMenuItems()

  // Feedback visibility comes from sidebar config so the user can toggle it
  // in "Sidebar configuration" settings like any other built-in item.
  const isFeedbackVisible = config?.items.some(
    (item) => item.id === 'feedback' && item.isVisible,
  )

  // Check if user has permission to view settings
  const canViewSettings = hasPermission('settings.view')

  // Kiosk is shown when kiosk mode is enabled and user has settings permission
  const showKiosk =
    kioskSettings?.enabled === true && hasPermission('settings.view')

  const handleSidebarItemClick = useSidebarItemClick()

  // The notifications bell lives in the header, at the right of the name.
  const bell = isScreenRoute ? null : (
    <NotificationsBell
      onClick={(e) => handleSidebarItemClick('/notifications', e)}
    />
  )

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  // Update webview bounds when sidebar collapses/expands
  useEffect(() => {
    // Small delay to let the CSS transition complete
    const timeoutId = setTimeout(() => {
      updateCurrentWebviewBounds()
    }, 350) // Match the CSS transition duration (300ms) + buffer

    return () => clearTimeout(timeoutId)
  }, [isCollapsed])

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop always visible, Mobile slide-in */}
      <aside
        data-testid="main-sidebar"
        data-collapsed={isCollapsed}
        className={`
          fixed md:relative z-50 md:z-auto
          flex flex-col h-full bg-panel border-r border-line
          transition-all duration-300 ease-in-out
          w-72 top-0 left-0
          safe-area-top safe-area-left safe-area-bottom
          ${isCollapsed ? 'md:w-20' : 'md:w-fit md:min-w-56 md:max-w-72'}
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* One header for every size: the name, the notifications bell, and
            on a phone the button that closes the menu. */}
        <SidebarHeader
          isCollapsed={isCollapsed}
          action={
            <>
              {bell}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg transition-colors"
                aria-label={t('sidebar:actions.closeMenu')}
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </>
          }
        />

        <nav className="flex-1 flex flex-col p-2 overflow-y-auto scrollbar-thin">
          {groupSidebarItems(menuItems).map((group, index) => (
            <section
              key={group.id}
              aria-label={t(`sidebar:groups.${group.id}`)}
              className={`flex flex-col gap-0.5 ${index > 0 ? 'mt-2 border-t border-line pt-2' : ''}`}
            >
              {!isCollapsed && (
                <h2 className="px-3 pt-1 pb-1.5 text-[13px] font-medium text-fg md:px-2.5">
                  {t(`sidebar:groups.${group.id}`)}
                </h2>
              )}
              {group.items.map((item) => (
                <SidebarItem
                  key={item.id}
                  pageId={item.id}
                  icon={item.icon}
                  label={item.label}
                  to={item.to}
                  isCollapsed={isCollapsed}
                  isActive={
                    location.pathname === item.to ||
                    location.pathname.startsWith(`${item.to}/`)
                  }
                  className="md:flex"
                  onClick={(e) => handleSidebarItemClick(item.to, e)}
                  shortcut={
                    routeShortcuts[item.to as keyof typeof routeShortcuts]
                  }
                  nativeWindowSettings={getItemNativeWindowSettings(item.id)}
                  iconName={getItemIconName(item.id)}
                  externalUrl={getItemExternalUrl(item.id)}
                  customIconUrl={item.customIconUrl}
                />
              ))}
            </section>
          ))}

          {/* Bottom section - fixed at the bottom, above the collapse button */}
          <div className="mt-auto space-y-0.5">
            {/* Kiosk - shown when kiosk mode is enabled */}
            {showKiosk && (
              <SidebarItem
                pageId="kiosk"
                icon={Monitor}
                label={t('sidebar:navigation.kiosk')}
                to="/kiosk"
                isCollapsed={isCollapsed}
                isActive={false}
                className="md:flex"
                onClick={(e) => handleSidebarItemClick('/kiosk', e)}
                nativeWindowSettings={getItemNativeWindowSettings('kiosk')}
              />
            )}

            {/* Divider */}
            <div className="my-1.5 border-t border-line" />

            {/* Feedback — opens the screenshot tool (mark it up, add notes)
                that files a public GitHub issue.
                Never rendered on /screen/* — those windows are church
                projector output. Visibility is user-controlled via Sidebar
                configuration in Settings (builtin id stays `feedback`). */}
            {!isScreenRoute && isFeedbackVisible && (
              <button
                type="button"
                data-testid="sidebar-request-feature"
                onClick={() => {
                  // Close the phone drawer so the app is visible to pick from.
                  setIsMobileMenuOpen(false)
                  setIsFeatureRequestOpen(true)
                }}
                className={`flex items-center gap-3 px-3 py-2.5 md:h-9 md:py-0 md:px-2.5 rounded-lg transition-colors w-full text-fg-label hover:bg-hover hover:text-fg ${isCollapsed ? 'md:justify-center' : ''}`}
                title={
                  isCollapsed ? t('sidebar:navigation.feedback') : undefined
                }
                aria-label={t('sidebar:navigation.feedback')}
              >
                <MessageSquarePlus
                  size={18}
                  strokeWidth={1.5}
                  className="flex-shrink-0"
                />
                <span className="text-sm font-medium md:hidden">
                  {t('sidebar:navigation.feedback')}
                </span>
                {!isCollapsed && (
                  <span className="text-sm font-medium hidden md:inline flex-1 text-left">
                    {t('sidebar:navigation.feedback')}
                  </span>
                )}
              </button>
            )}

            {/* Settings */}
            {canViewSettings && (
              <SidebarItem
                pageId="settings"
                icon={Settings}
                label={t('sidebar:navigation.settings')}
                to="/settings"
                isCollapsed={isCollapsed}
                isActive={
                  location.pathname === '/settings' ||
                  location.pathname.startsWith('/settings/')
                }
                className="md:flex"
                onClick={(e) => handleSidebarItemClick('/settings', e)}
                nativeWindowSettings={getItemNativeWindowSettings('settings')}
              />
            )}

            {/* Current user — opens the account page (profile, permissions,
                switch user, log out), replacing the current page content. */}
            <CurrentUserButton isCollapsed={isCollapsed} />
          </div>
        </nav>

        <div className="p-2 border-t border-line">
          {/* Desktop-only collapse button */}
          <button
            onClick={toggleCollapsed}
            data-testid="sidebar-collapse-toggle"
            className={`hidden md:flex w-full h-9 items-center gap-3 px-2.5 rounded-lg
              text-fg-label hover:bg-hover hover:text-fg
              transition-colors ${isCollapsed ? 'justify-center' : ''}`}
            title={
              isCollapsed
                ? t('sidebar:actions.expand')
                : t('sidebar:actions.collapseSidebar')
            }
          >
            {isCollapsed ? (
              <ChevronRight
                size={18}
                strokeWidth={1.5}
                className="flex-shrink-0"
              />
            ) : (
              <>
                <ChevronLeft
                  size={18}
                  strokeWidth={1.5}
                  className="flex-shrink-0"
                />
                <span className="text-sm font-medium">
                  {t('sidebar:actions.collapse')}
                </span>
              </>
            )}
          </button>
        </div>
      </aside>

      {isFeatureRequestOpen && (
        <RequestFeatureTool onClose={() => setIsFeatureRequestOpen(false)} />
      )}
    </>
  )
}
