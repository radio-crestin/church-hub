import { useLocation } from '@tanstack/react-router'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Menu,
  Monitor,
  Moon,
  Music,
  Settings,
  SquarePlay,
  Sun,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SidebarHeader } from './sidebar-header'
import { SidebarItem } from './sidebar-item'
import { useTheme } from '../../provider/theme-provider'

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { preference, setThemePreference } = useTheme()
  const location = useLocation()
  const { t } = useTranslation(['sidebar', 'common'])

  const cycleTheme = () => {
    const cycle = { system: 'light', light: 'dark', dark: 'system' } as const
    setThemePreference(cycle[preference])
  }

  const menuItems = [
    {
      icon: SquarePlay,
      label: t('sidebar:navigation.present'),
      to: '/present',
    },
    {
      icon: Music,
      label: t('sidebar:navigation.songs'),
      to: '/songs',
    },
    {
      icon: CalendarDays,
      label: t('sidebar:navigation.schedules'),
      to: '/schedules',
    },
    {
      icon: Settings,
      label: t('sidebar:navigation.settings'),
      to: '/settings',
    },
  ]

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

  const themeLabel =
    preference === 'system'
      ? t('common:theme.system')
      : preference === 'light'
        ? t('common:theme.lightMode')
        : t('common:theme.darkMode')

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
              key={item.to}
              icon={item.icon}
              label={item.label}
              to={item.to}
              isCollapsed={isCollapsed}
              isActive={
                location.pathname === item.to ||
                location.pathname.startsWith(`${item.to}/`)
              }
              className="md:flex"
            />
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-2">
          <button
            onClick={cycleTheme}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg
              text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800
              transition-colors"
            title={isCollapsed ? t('common:theme.toggleTheme') : undefined}
          >
            {preference === 'system' ? (
              <Monitor size={20} className="flex-shrink-0" />
            ) : preference === 'light' ? (
              <Sun size={20} className="flex-shrink-0" />
            ) : (
              <Moon size={20} className="flex-shrink-0" />
            )}
            {/* Mobile: always show label, Desktop: respect isCollapsed */}
            <span className="text-sm font-medium md:hidden">{themeLabel}</span>
            {!isCollapsed && (
              <span className="text-sm font-medium hidden md:inline">
                {themeLabel}
              </span>
            )}
          </button>

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
