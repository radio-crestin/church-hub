import { useTranslation } from 'react-i18next'

import { SettingsNavItem } from './SettingsNavItem'
import type { SettingsNavGroupDef } from '../registry'

interface SettingsNavGroupProps {
  group: SettingsNavGroupDef
}

/** A settings rail group: a static label header followed by its leaf items. */
export function SettingsNavGroup({ group }: SettingsNavGroupProps) {
  const { t } = useTranslation('settings')

  return (
    <div>
      <div className="px-2.5 py-1.5 text-xs font-medium text-fg-hint">
        {t(group.labelKey)}
      </div>
      <div className="mt-0.5 space-y-0.5">
        {group.items.map((item) => (
          <SettingsNavItem
            key={item.id}
            icon={item.icon}
            label={t(item.labelKey)}
            to={item.to}
          />
        ))}
      </div>
    </div>
  )
}
