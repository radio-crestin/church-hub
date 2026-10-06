import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface SettingsSectionProps {
  title?: string
  description?: string
  icon?: LucideIcon
  children: ReactNode
  testId?: string
}

/** Consistent titled card wrapper for a settings panel. */
export function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
  testId,
}: SettingsSectionProps) {
  const header =
    title || description ? (
      <div className="mb-4">
        {title && (
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            {Icon && (
              <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            )}
            {title}
          </h2>
        )}
        {description && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
    ) : null

  return (
    <div
      data-testid={testId}
      className="flex-1 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
    >
      {header}
      {children}
    </div>
  )
}
