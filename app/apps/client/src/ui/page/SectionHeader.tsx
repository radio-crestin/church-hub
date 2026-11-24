import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface SectionHeaderProps {
  title?: string
  description?: ReactNode
  icon?: LucideIcon
  /** Buttons on the right; on a narrow screen they wrap under the text. */
  actions?: ReactNode
}

/** A card's title row: the title and a line under it, actions on the right. */
export function SectionHeader({
  title,
  description,
  icon: Icon,
  actions,
}: SectionHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 basis-56">
        {title && (
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            {Icon && (
              <Icon className="h-5 w-5 shrink-0 text-gray-600 dark:text-gray-400" />
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
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
