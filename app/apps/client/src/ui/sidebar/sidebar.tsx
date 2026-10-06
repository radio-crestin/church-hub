import { useLocation, useNavigate } from '@tanstack/react-router'
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
import { CurrentUserButton } from '../../features/auth'
import { RequestFeatureTool } from '../../features/feature-request'
import { useKioskSettings } from '../../features/kiosk'
import { NotificationsSidebarItem } from '../../features/notifications/components/NotificationsSidebarItem'
import { usePresentationState } from '../../features/presentation'
import {
  hideAllCustomPageWebviews,
  updateCurrentWebviewBounds,
  useResolvedSidebarItems,
  useSidebarConfig,
  useSidebarItemShortcuts,
} from '../../features/sidebar-config'
import { DEFAULT_ICON_COLORS } from '../../features/sidebar-config/constants'
import type {
  BuiltInMenuItem,
  CustomPageMenuItem,
  IconColor,
  NativeWindowSettings,
} from '../../features/sidebar-config/types'
import type { Permission } from '../../features/users/types'
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
  const navigate = useNavigate()
  const { t } = useTranslation(['sidebar', 'common'])
  const { hasPermission } = usePermissions()

  // Get sidebar configuration
  const { config } = useSidebarConfig()
  const resolvedItems = useResolvedSidebarItems(config?.items)

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

  // Get icon color for an item
  const getItemIconColor = useCallback(
    (itemId: string): IconColor | undefined => {
      const item = config?.items.find((i) => i.id === itemId)
      if (item?.settings?.iconColor) {
        return item.settings.iconColor
      }
      // Return default color for builtin items
      if (item?.type === 'builtin') {
        return DEFAULT_ICON_COLORS[(item as BuiltInMenuItem).builtinId]
      }
      return 'gray'
    },
    [config],
  )

  // Get kiosk settings to determine if kiosk menu item should be visible
  const { data: kioskSettings } = useKioskSettings()

  // Get presentation state to redirect Bible menu to current verse
  const { data: presentationState } = usePresentationState()

  // Filter items by permission (excluding settings, kiosk and feedback -
  // they're rendered separately as special-case buttons below)
  const menuItems = resolvedItems.filter((item) => {
    if (
      item.id === 'settings' ||
      item.id === 'kiosk' ||
      item.id === 'feedback'
    ) {
      return false
    }
    // Custom pages: check dynamic permission
    if (item.isCustom) {
      return hasPermission(item.permission as Permission)
    }
    // Built-in items: check their permission
    return item.permission ? hasPermission(item.permission) : true
  })

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

  // Hide webview when clicking on non-custom-page items (keep running in background)
  // For kiosk item, navigate to the configured startup page
  // For Bible item, navigate to currently displayed/selected verse if available
  const handleSidebarItemClick = useCallback(
    (destinationPath: string, e?: React.MouseEvent<HTMLAnchorElement>) => {
      // If navigating to a non-custom-page, hide ALL custom page webviews
      if (!destinationPath.startsWith('/custom-page/')) {
        void hideAllCustomPageWebviews()
      }

      // Handle Bible navigation - go to currently displayed verse if available
      // But only if not currently viewing search results (URL has ?q= param)
      if (destinationPath === '/bible') {
        const hasSearchQuery =
          'q' in (location.search as Record<string, unknown>)
        const tempContent = presentationState?.temporaryContent
        if (
          !hasSearchQuery &&
          tempContent?.type === 'bible' &&
          !presentationState?.isHidden
        ) {
          e?.preventDefault()
          const { bookId, bookName, chapter, currentVerseIndex } =
            tempContent.data
          navigate({
            to: '/bible',
            search: {
              book: bookId,
              bookName: bookName,
              chapter: chapter,
              verse: currentVerseIndex + 1, // Convert 0-based index to 1-based verse
            },
          })
          return
        }
      }

      // Handle kiosk navigation - go to configured startup page instead of /kiosk
      if (destinationPath === '/kiosk' && kioskSettings?.enabled) {
        e?.preventDefault()
        const { startupPage } = kioskSettings
        if (startupPage.type === 'screen') {
          navigate({ to: `/screen/${startupPage.screenId}` })
        } else {
          navigate({ to: startupPage.path })
        }
      }
    },
    [kioskSettings, navigate, presentationState],
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
          flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
          transition-all duration-300 ease-in-out
          w-72 top-0 left-0
          safe-area-top safe-area-left safe-area-bottom
          ${isCollapsed ? 'md:w-20' : 'md:w-fit md:min-w-56 md:max-w-72'}
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Mobile Close Button */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <img src="/logo192.png" alt="Church Hub" className="w-8 h-8" />
            <span className="font-semibold text-gray-900 dark:text-white">
              Church Hub
            </span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={t('sidebar:actions.closeMenu')}
          >
            <X size={24} />
          </button>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:block">
          <SidebarHeader isCollapsed={isCollapsed} />
        </div>

        <nav className="flex-1 flex flex-col gap-2 p-3 overflow-y-auto scrollbar-thin">
          {menuItems.map((item) => (
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
              shortcut={routeShortcuts[item.to as keyof typeof routeShortcuts]}
              nativeWindowSettings={getItemNativeWindowSettings(item.id)}
              iconName={getItemIconName(item.id)}
              externalUrl={getItemExternalUrl(item.id)}
              iconColor={getItemIconColor(item.id)}
              customIconUrl={item.customIconUrl}
              faviconBgColor={item.faviconBgColor}
            />
          ))}

          {/* Bottom section - fixed at the bottom, above the collapse button */}
          <div className="mt-auto space-y-1">
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
                iconColor={getItemIconColor('kiosk')}
              />
            )}

            {/* Divider */}
            <div className="my-2 border-t border-gray-200 dark:border-gray-700" />

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
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all w-full text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 ${isCollapsed ? 'md:justify-center' : ''}`}
                title={
                  isCollapsed ? t('sidebar:navigation.feedback') : undefined
                }
                aria-label={t('sidebar:navigation.feedback')}
              >
                <span className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                  <MessageSquarePlus
                    size={16}
                    className="text-gray-600 dark:text-gray-400"
                  />
                </span>
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

            {/* Notifications (synced songs, app updates): the page with
                all of them, the unread count, and the pop-up of a new one. */}
            {!isScreenRoute && (
              <NotificationsSidebarItem
                isCollapsed={isCollapsed}
                iconColor={getItemIconColor('settings')}
                onClick={(e) => handleSidebarItemClick('/notifications', e)}
              />
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
                iconColor={getItemIconColor('settings')}
              />
            )}

            {/* Current user — opens the account page (profile, permissions,
                switch user, log out), replacing the current page content. */}
            <CurrentUserButton isCollapsed={isCollapsed} />
          </div>
        </nav>

        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
          {/* Desktop-only collapse button */}
          <button
            onClick={toggleCollapsed}
            data-testid="sidebar-collapse-toggle"
            className="hidden md:flex w-full items-center gap-3 px-4 py-3 rounded-lg
              text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800
              transition-colors"
            title={
              isCollapsed
                ? t('sidebar:actions.expand')
                : t('sidebar:actions.collapseSidebar')
            }
          >
            {isCollapsed ? (
              <ChevronRight size={20} className="flex-shrink-0" />
            ) : (
              <>
                <ChevronLeft size={20} className="flex-shrink-0" />
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
