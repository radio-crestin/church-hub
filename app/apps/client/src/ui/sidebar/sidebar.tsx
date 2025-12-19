import { useLocation } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Menu, Settings, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SidebarHeader } from './sidebar-header'
import { SidebarItem } from './sidebar-item'
import {
  hideAllCustomPageWebviews,
  updateCurrentWebviewBounds,
  useResolvedSidebarItems,
  useSidebarConfig,
} from '../../features/sidebar-config'
import type { Permission } from '../../features/users/types'
import { usePermissions } from '../../provider/permissions-provider'

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()
  const { t } = useTranslation(['sidebar', 'common'])
  const { hasPermission } = usePermissions()

  // Get sidebar configuration
  const { config } = useSidebarConfig()
  const resolvedItems = useResolvedSidebarItems(config?.items)

  // Filter items by permission (excluding settings - it's fixed at the bottom)
  const menuItems = resolvedItems.filter((item) => {
    // Exclude settings from configurable items - it's rendered separately at the bottom
    if (item.id === 'settings') {
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

  // Hide webview when clicking on non-custom-page items (keep running in background)
  const handleSidebarItemClick = useCallback((destinationPath: string) => {
    // If navigating to a non-custom-page, hide ALL custom page webviews
    if (!destinationPath.startsWith('/custom-page/')) {
      void hideAllCustomPageWebviews()
    }
  }, [])

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
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
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
              onClick={() => handleSidebarItemClick(item.to)}
            />
          ))}

          {/* Settings - fixed at the bottom, above the collapse button */}
          {canViewSettings && (
            <div className="mt-auto">
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
                onClick={() => handleSidebarItemClick('/settings')}
              />
            </div>
          )}
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
    </>
  )
}
