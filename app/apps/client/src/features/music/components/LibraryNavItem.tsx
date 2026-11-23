import type { LucideIcon } from 'lucide-react'

interface LibraryNavItemProps {
  icon: LucideIcon
  label: string
  count?: number
  isSelected: boolean
  onSelect: () => void
  testId: string
}

/** One entry of the library column: a view of the music, with its count. */
export function LibraryNavItem({
  icon: Icon,
  label,
  count,
  isSelected,
  onSelect,
  testId,
}: LibraryNavItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isSelected ? 'page' : undefined}
      data-testid={testId}
      className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors lg:w-full ${
        isSelected
          ? 'bg-indigo-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 lg:bg-transparent dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 lg:dark:bg-transparent'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span
          className={`rounded px-1.5 text-xs tabular-nums ${
            isSelected
              ? 'bg-white/20'
              : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}
