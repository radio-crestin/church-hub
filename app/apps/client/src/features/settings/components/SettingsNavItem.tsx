import { Link, useLocation } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'

interface SettingsNavItemProps {
  icon: LucideIcon
  label: string
  to: string
}

/**
 * A single leaf link in the settings rail. Mirrors the app sidebar item
 * active/inactive styling for visual consistency.
 */
export function SettingsNavItem({
  icon: Icon,
  label,
  to,
}: SettingsNavItemProps) {
  const { pathname } = useLocation()
  const isActive = pathname === to

  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
      }`}
    >
      <Icon
        size={17}
        className={`flex-shrink-0 ${
          isActive
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-gray-400 dark:text-gray-500'
        }`}
      />
      <span className="flex-1 truncate">{label}</span>
    </Link>
  )
}
