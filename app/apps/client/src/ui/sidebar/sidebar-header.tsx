import { AppMark } from '../brand/AppMark'

interface SidebarHeaderProps {
  isCollapsed: boolean
}

export function SidebarHeader({ isCollapsed }: SidebarHeaderProps) {
  return (
    <div
      className={`flex h-14 items-center gap-2.5 border-b border-line px-5 ${isCollapsed ? 'justify-center px-0' : ''}`}
    >
      <AppMark size={24} />
      {!isCollapsed && (
        <span className="text-sm font-semibold tracking-[-0.01em] text-fg">
          Church Hub
        </span>
      )}
    </div>
  )
}
