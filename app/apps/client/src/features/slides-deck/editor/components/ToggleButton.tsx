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
      className={`rounded-md p-1.5 ${
        active
          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
      }`}
    >
      <Icon size={16} />
    </button>
  )
}
