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
      className={`flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors ${
        isActive
          ? 'bg-selected text-fg'
          : 'text-fg-label hover:bg-hover hover:text-fg'
      }`}
    >
      <Icon size={16} strokeWidth={1.5} className="flex-shrink-0" />
      <span className="flex-1 truncate">{label}</span>
    </Link>
  )
}
