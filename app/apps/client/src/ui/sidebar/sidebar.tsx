import { useLocation } from '@tanstack/react-router'
import {
  ChevronLeft,
  ChevronRight,
  Film,
  Monitor,
  Moon,
  Presentation,
  Settings,
  Sun,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SidebarHeader } from './sidebar-header'
import { SidebarItem } from './sidebar-item'
import { useTheme } from '../../provider/theme-provider'

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { preference, setThemePreference } = useTheme()
  const location = useLocation()
  const { t } = useTranslation(['sidebar', 'common'])

  const cycleTheme = () => {
    const cycle = { system: 'light', light: 'dark', dark: 'system' } as const
    setThemePreference(cycle[preference])
  }

  const menuItems = [
    {
      icon: Film,
      label: t('sidebar:navigation.present'),
      to: '/present',
    },
    {
      icon: Presentation,
      label: t('sidebar:navigation.programs'),
      to: '/programs',
    },
    {
      icon: Settings,
      label: t('sidebar:navigation.settings'),
      to: '/settings',
    },
  ]

  return (
    <aside
      className={`
        flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
        transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-20' : 'w-64'}
      `}
    >
      <SidebarHeader isCollapsed={isCollapsed} />

      <nav className="flex-1 flex flex-col gap-2 p-3 overflow-y-auto">
        {menuItems.map((item) => (
          <SidebarItem
            key={item.to}
            icon={item.icon}
            label={item.label}
            to={item.to}
            isCollapsed={isCollapsed}
            isActive={location.pathname === item.to}
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
          {!isCollapsed && (
            <span className="text-sm font-medium">
              {preference === 'system'
                ? t('common:theme.system')
                : preference === 'light'
                  ? t('common:theme.lightMode')
                  : t('common:theme.darkMode')}
            </span>
          )}
        </button>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg
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
  )
}
