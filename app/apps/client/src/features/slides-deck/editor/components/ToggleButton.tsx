import type { LucideIcon } from 'lucide-react'

interface ToggleButtonProps {
  icon: LucideIcon
  label: string
  active?: boolean
  onClick: () => void
  testId?: string
}

/** An icon button of the panel's text controls (bold, align, bullets). */
export function ToggleButton({
  icon: Icon,
  label,
  active,
  onClick,
  testId,
}: ToggleButtonProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      title={label}
      aria-label={label}
      aria-pressed={active}
      // Keeps the text's selection while the box is being edited.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`rounded-lg p-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus ${
        active
          ? 'bg-selected text-fg'
          : 'text-fg-label hover:bg-hover hover:text-fg'
      }`}
    >
      <Icon size={16} strokeWidth={1.5} />
    </button>
  )
}
