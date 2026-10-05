import { useState } from 'react'

const PROGRAMS_EXPANDED_KEY = 'sidebar.programsExpanded'

/**
 * Whether the sidebar shows the list of programs under "Programs". Open by
 * default; only the user's own choice is saved.
 */
export function useSidebarProgramsExpanded() {
  const [isExpanded, setIsExpanded] = useState(
    () => localStorage.getItem(PROGRAMS_EXPANDED_KEY) !== 'false',
  )

  function toggleExpanded() {
    const next = !isExpanded
    localStorage.setItem(PROGRAMS_EXPANDED_KEY, String(next))
    setIsExpanded(next)
  }

  return { isExpanded, toggleExpanded }
}
