import { useState } from 'react'

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

/**
 * Whether the main sidebar is collapsed. Only the user's own choice is saved:
 * with nothing saved (a fresh install) the sidebar starts expanded, and the
 * default is never written back as if the user had chosen it.
 */
export function useSidebarCollapsed() {
  const [isCollapsed, setIsCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
  )

  function toggleCollapsed() {
    const next = !isCollapsed
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
    setIsCollapsed(next)
  }

  return { isCollapsed, toggleCollapsed }
}
