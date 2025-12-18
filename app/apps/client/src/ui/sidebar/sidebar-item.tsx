import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'

interface SidebarItemProps {
  icon: LucideIcon
  label: string
  to: string
  isCollapsed: boolean
  isActive: boolean
  className?: string
  disabled?: boolean
  onClick?: () => void
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
}: SidebarItemProps) {
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
        <span className="text-sm font-medium hidden md:inline">{label}</span>
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
      onClick={onClick}
    >
      {content}
    </Link>
  )
}
