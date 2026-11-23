import { useState } from 'react'

import { isLocalhost, isMobile } from '~/config'
import { usePermissions } from '~/provider/permissions-provider'
import { SettingsNavGroup } from './SettingsNavGroup'
import { SettingsSearch } from './SettingsSearch'
import { getVisibleGroups } from '../registry'

/**
 * The settings category rail: a search over every setting the user may see,
 * then every permission-visible group, which the search results replace while
 * it holds a query.
 */
export function SettingsSidebar() {
  const { hasPermission } = usePermissions()
  const [query, setQuery] = useState('')

  const groups = getVisibleGroups({
    hasPermission,
    isMobile: isMobile(),
    isLocalhost: isLocalhost(),
  })

  return (
    <nav className="space-y-3 pt-1">
      <SettingsSearch groups={groups} query={query} onQueryChange={setQuery} />
      {!query.trim() &&
        groups.map((group) => (
          <SettingsNavGroup key={group.id} group={group} />
        ))}
    </nav>
  )
}
