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
      className={`flex min-h-11 w-full shrink-0 items-center gap-2 rounded-lg px-2.5 text-left text-sm transition-colors lg:min-h-9 ${
        isSelected
          ? 'bg-selected text-fg'
          : 'text-fg-label hover:bg-hover hover:text-fg'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="text-xs tabular-nums text-fg-hint">{count}</span>
      )}
    </button>
  )
}
