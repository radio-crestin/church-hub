import type { ReactNode } from 'react'

import { AppMark } from '../brand/AppMark'

interface SidebarHeaderProps {
  /** Collapsed applies on desktop only; the phone menu always shows the name. */
  isCollapsed: boolean
  /** The notifications bell (and the phone menu's close button), at the right of the name. */
  action?: ReactNode
}

export function SidebarHeader({ isCollapsed, action }: SidebarHeaderProps) {
  return (
    <div
      className={`flex h-14 shrink-0 items-center gap-1.5 border-b border-line pl-5 pr-3 ${
        isCollapsed
          ? 'md:h-auto md:flex-col md:justify-center md:gap-2 md:px-0 md:py-3'
          : ''
      }`}
    >
      <AppMark size={24} />
      <span
        className={`ml-1 flex-1 truncate text-sm font-semibold tracking-[-0.01em] text-fg ${
          isCollapsed ? 'md:hidden' : ''
        }`}
      >
        Church Hub
      </span>
      {action}
    </div>
  )
}
