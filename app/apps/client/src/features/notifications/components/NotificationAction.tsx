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
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
        primary
          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
          : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
      }`}
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  )
}
