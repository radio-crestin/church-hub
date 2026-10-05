import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SidebarProgramList } from './SidebarProgramList'
import { useSidebarProgramsExpanded } from '../../hooks/useSidebarProgramsExpanded'

interface SidebarProgramsProps {
  isCollapsed: boolean
  /** Draws the sidebar's own "Programs" link, with the toggle beside it. */
  renderEntry: (trailing: React.ReactNode) => React.ReactNode
}

/**
 * The sidebar's "Programs" entry, with the programs listed under it: open,
 * make, import, rename, save and delete them from anywhere in the app.
 */
export function SidebarPrograms({
  isCollapsed,
  renderEntry,
}: SidebarProgramsProps) {
  const { t } = useTranslation('schedules')
  const { isExpanded, toggleExpanded } = useSidebarProgramsExpanded()
  // A collapsed (icons only) sidebar has no room for the list; the phone
  // drawer always shows labels, so it keeps it.
  const hiddenWhenCollapsed = isCollapsed ? 'md:hidden' : ''

  const toggle = (
    <button
      type="button"
      onClick={toggleExpanded}
      aria-expanded={isExpanded}
      aria-label={t(
        isExpanded ? 'sidebar.hidePrograms' : 'sidebar.showPrograms',
      )}
      title={t(isExpanded ? 'sidebar.hidePrograms' : 'sidebar.showPrograms')}
      data-testid="sidebar-programs-toggle"
      className={`p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors ${hiddenWhenCollapsed}`}
    >
      <ChevronDown
        size={16}
        className={`transition-transform ${isExpanded ? '' : '-rotate-90'}`}
      />
    </button>
  )

  return (
    <div data-testid="sidebar-programs">
      {renderEntry(toggle)}
      {isExpanded && (
        <div className={hiddenWhenCollapsed}>
          <SidebarProgramList />
        </div>
      )}
    </div>
  )
}
