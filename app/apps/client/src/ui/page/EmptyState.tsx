import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  hint?: string
}

/** What a list shows while it has nothing: an icon, a line, and a hint. */
export function EmptyState({ icon: Icon, title, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 px-6 py-12 text-center dark:border-gray-600">
      <Icon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
      <p className="font-medium text-gray-700 dark:text-gray-200">{title}</p>
      {hint && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{hint}</p>
      )}
    </div>
  )
}
