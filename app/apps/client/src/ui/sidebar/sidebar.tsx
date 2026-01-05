import { useLocation, useNavigate } from '@tanstack/react-router'
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  MessageSquarePlus,
  Monitor,
  Settings,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SidebarHeader } from './sidebar-header'
import { SidebarItem } from './sidebar-item'
import { ContactModal, FeedbackModal } from '../../features/feedback'
import { useKioskSettings } from '../../features/kiosk'
import {
  hideAllCustomPageWebviews,
  updateCurrentWebviewBounds,
  useResolvedSidebarItems,
  useSidebarConfig,
} from '../../features/sidebar-config'
import type { Permission } from '../../features/users/types'
import { usePermissions } from '../../provider/permissions-provider'

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    return saved !== null ? saved === 'true' : true // Default to collapsed
  })
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation(['sidebar', 'common'])
  const { hasPermission } = usePermissions()

  // Get sidebar configuration
  const { config } = useSidebarConfig()
  const resolvedItems = useResolvedSidebarItems(config?.items)

  // Get kiosk settings to determine if kiosk menu item should be visible
  const { data: kioskSettings } = useKioskSettings()

  // Filter items by permission (excluding settings and kiosk - they're rendered separately)
  const menuItems = resolvedItems.filter((item) => {
    // Exclude settings and kiosk - they're rendered separately
    if (item.id === 'settings' || item.id === 'kiosk') {
      return false
    }
    // Custom pages: check dynamic permission
    if (item.isCustom) {
      return hasPermission(item.permission as Permission)
    }
    // Built-in items: check their permission
    return item.permission ? hasPermission(item.permission) : true
  })

  // Check if user has permission to view settings
  const canViewSettings = hasPermission('settings.view')

  // Kiosk is shown when kiosk mode is enabled and user has settings permission
  const showKiosk =
    kioskSettings?.enabled === true && hasPermission('settings.view')

  // Hide webview when clicking on non-custom-page items (keep running in background)
  // For kiosk item, navigate to the configured startup page
  const handleSidebarItemClick = useCallback(
    (destinationPath: string, e?: React.MouseEvent<HTMLAnchorElement>) => {
      // If navigating to a non-custom-page, hide ALL custom page webviews
      if (!destinationPath.startsWith('/custom-page/')) {
        void hideAllCustomPageWebviews()
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
    [kioskSettings, navigate],
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

  // Persist sidebar collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed))
  }, [isCollapsed])

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
      {/* Mobile Header - extends behind status bar for fullscreen effect */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 safe-area-top safe-area-left safe-area-right">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo192.png" alt="Church Hub" className="w-8 h-8" />
            <span className="font-semibold text-gray-900 dark:text-white">
              Church Hub
            </span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={t('sidebar:actions.openMenu')}
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop always visible, Mobile slide-in */}
      <aside
        className={`
          fixed md:relative z-50 md:z-auto
          flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
          transition-all duration-300 ease-in-out
          w-72 md:w-auto top-0 left-0
          safe-area-top safe-area-left safe-area-bottom
          ${isCollapsed ? 'md:w-20' : 'md:w-64'}
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

        <nav className="flex-1 flex flex-col gap-2 p-3 overflow-y-auto">
          {menuItems.map((item) => (
            <SidebarItem
              key={item.id}
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
            />
          ))}

          {/* Bottom section - fixed at the bottom, above the collapse button */}
          <div className="mt-auto space-y-1">
            {/* Kiosk - shown when kiosk mode is enabled */}
            {showKiosk && (
              <SidebarItem
                icon={Monitor}
                label={t('sidebar:navigation.kiosk')}
                to="/kiosk"
                isCollapsed={isCollapsed}
                isActive={false}
                className="md:flex"
                onClick={(e) => handleSidebarItemClick('/kiosk', e)}
              />
            )}

            {/* Divider */}
            <div className="my-2 border-t border-gray-200 dark:border-gray-700" />

            {/* Feedback */}
            <button
              onClick={() => setIsFeedbackModalOpen(true)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-full ${isCollapsed ? 'md:justify-center' : ''}`}
              title={t('sidebar:navigation.feedback')}
            >
              <MessageSquarePlus size={20} className="flex-shrink-0" />
              {!isCollapsed && (
                <span className="text-sm font-medium md:block">
                  {t('sidebar:navigation.feedback')}
                </span>
              )}
              <span className="md:hidden text-sm font-medium">
                {t('sidebar:navigation.feedback')}
              </span>
            </button>

            {/* Settings */}
            {canViewSettings && (
              <SidebarItem
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
              />
            )}
          </div>
        </nav>

        <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-2">
          {/* Desktop-only collapse button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
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

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        onOpenContact={() => setIsContactModalOpen(true)}
      />

      {/* Contact Modal */}
      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        onBack={() => {
          setIsContactModalOpen(false)
          setIsFeedbackModalOpen(true)
        }}
      />
    </>
  )
}
