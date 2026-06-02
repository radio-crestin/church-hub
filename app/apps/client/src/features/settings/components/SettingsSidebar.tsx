import { isLocalhost, isMobile } from '~/config'
import { usePermissions } from '~/provider/permissions-provider'
import { SettingsNavGroup } from './SettingsNavGroup'
import { getVisibleGroups } from '../registry'

/** The settings category rail. Renders every permission-visible group. */
export function SettingsSidebar() {
  const { hasPermission } = usePermissions()

  const groups = getVisibleGroups({
    hasPermission,
    isMobile: isMobile(),
    isLocalhost: isLocalhost(),
  })

  return (
    <nav className="space-y-3 pt-1">
      {groups.map((group) => (
        <SettingsNavGroup key={group.id} group={group} />
      ))}
    </nav>
  )
}
