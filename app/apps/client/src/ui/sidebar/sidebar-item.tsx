import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'

interface SidebarItemProps {
  icon: LucideIcon
  label: string
  to: string
  isCollapsed: boolean
  isActive: boolean
  className?: string
}

export function SidebarItem({
  icon: Icon,
  label,
  to,
  isCollapsed,
  isActive,
  className = '',
}: SidebarItemProps) {
  return (
    <Link
      to={to}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg transition-all
        ${
          isActive
            ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
        }
        ${isCollapsed ? 'md:justify-center' : ''}
        ${className}
      `}
      title={isCollapsed ? label : undefined}
    >
      <Icon size={20} className="flex-shrink-0" />
      {/* Mobile: always show label, Desktop: respect isCollapsed */}
      <span className="text-sm font-medium md:hidden">{label}</span>
      {!isCollapsed && (
        <span className="text-sm font-medium hidden md:inline">{label}</span>
      )}
    </Link>
  )
}
