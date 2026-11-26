import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/** A notification's button: `primary` for the main thing to do. */
export function NotificationAction({
  onClick,
  primary = false,
  disabled = false,
  icon: Icon,
  children,
  testId,
}: {
  onClick: () => void
  primary?: boolean
  disabled?: boolean
  icon?: LucideIcon
  children: ReactNode
  testId?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 h-8 rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-60 ${
        primary
          ? 'bg-primary text-white hover:bg-indigo-700'
          : 'bg-field text-fg hover:bg-hover'
      }`}
    >
      {Icon && <Icon size={14} strokeWidth={1.75} />}
      {children}
    </button>
  )
}
