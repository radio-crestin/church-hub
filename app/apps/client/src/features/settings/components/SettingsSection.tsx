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
      className="flex-1 rounded-lg border border-gray-200 bg-white p-4 transition-colors sm:p-6 data-[active]:border-indigo-400 data-[active]:ring-1 data-[active]:ring-indigo-400/40 dark:border-gray-800 dark:bg-gray-900 dark:data-[active]:border-indigo-500 dark:data-[active]:ring-indigo-500/40"
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
