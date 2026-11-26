import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { SectionHeader } from '~/ui/page'

interface SettingsSectionProps {
  title?: string
  description?: string
  icon?: LucideIcon
  children: ReactNode
  /** Buttons on the right of the title. */
  actions?: ReactNode
  testId?: string
}

/**
 * Consistent titled card wrapper for a settings panel; highlighted while it
 * carries `data-active` (the section in view on a Live Stream settings page).
 */
export function SettingsSection({
  title,
  description,
  icon,
  actions,
  children,
  testId,
}: SettingsSectionProps) {
  return (
    <div
      data-testid={testId}
      className="flex-1 rounded-xl border border-line bg-panel p-4 transition-colors sm:p-5 data-[active]:border-line-strong"
    >
      {(title || description || actions) && (
        <SectionHeader
          title={title}
          description={description}
          icon={icon}
          actions={actions}
        />
      )}
      {children}
    </div>
  )
}
