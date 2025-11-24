interface SidebarHeaderProps {
  isCollapsed: boolean
}

export function SidebarHeader({ isCollapsed }: SidebarHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-200 dark:border-gray-800">
      <img
        src="/logo192.png"
        alt="Church Hub"
        className="flex-shrink-0"
        style={{ width: isCollapsed ? 32 : 40, height: isCollapsed ? 32 : 40 }}
      />
      {!isCollapsed && (
        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            Church Hub
          </h1>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Manage your church
          </span>
        </div>
      )}
    </div>
  )
}
