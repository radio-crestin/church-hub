import type { LucideIcon } from 'lucide-react'

import type { ChangeEntry } from '../types'

interface ChangeCategoryListProps {
  icon: LucideIcon
  label: string
  entries: ChangeEntry[]
}

export function ChangeCategoryList({
  icon: Icon,
  label,
  entries,
}: ChangeCategoryListProps) {
  if (entries.length === 0) return null

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-fg-label">
        <Icon size={14} strokeWidth={1.75} />
        <span>
          {label} ({entries.length})
        </span>
      </div>
      <ul className="space-y-1 pl-1">
        {entries.map((entry, index) => (
          <li
            key={`${index}-${entry.scope ?? ''}-${entry.message}`}
            className="text-sm text-fg-body flex gap-2"
          >
            <span className="text-fg-hint select-none">•</span>
            <span>
              {entry.scope && (
                <span className="font-medium text-fg">{entry.scope}: </span>
              )}
              {entry.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
