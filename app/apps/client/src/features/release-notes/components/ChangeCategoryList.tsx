import type { LucideIcon } from 'lucide-react'

import type { ChangeEntry } from '../types'

interface ChangeCategoryListProps {
  icon: LucideIcon
  label: string
  /** Tailwind text-color class for the heading + icon, e.g. "text-green-600". */
  accentClassName: string
  entries: ChangeEntry[]
}

export function ChangeCategoryList({
  icon: Icon,
  label,
  accentClassName,
  entries,
}: ChangeCategoryListProps) {
  if (entries.length === 0) return null

  return (
    <div className="space-y-1.5">
      <div
        className={`flex items-center gap-1.5 text-xs font-semibold ${accentClassName}`}
      >
        <Icon size={14} />
        <span>
          {label} ({entries.length})
        </span>
      </div>
      <ul className="space-y-1 pl-1">
        {entries.map((entry, index) => (
          <li
            key={`${index}-${entry.scope ?? ''}-${entry.message}`}
            className="text-sm text-gray-700 dark:text-gray-300 flex gap-2"
          >
            <span className="text-gray-400 dark:text-gray-600 select-none">
              •
            </span>
            <span>
              {entry.scope && (
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {entry.scope}:{' '}
                </span>
              )}
              {entry.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
