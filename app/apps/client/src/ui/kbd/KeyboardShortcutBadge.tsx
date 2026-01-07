import { formatShortcutForDisplay } from '~/features/keyboard-shortcuts'

interface KeyboardShortcutBadgeProps {
  shortcut: string
  size?: 'sm' | 'md'
  variant?: 'default' | 'muted'
  className?: string
}

export function KeyboardShortcutBadge({
  shortcut,
  size = 'sm',
  variant = 'default',
  className = '',
}: KeyboardShortcutBadgeProps) {
  const sizeClasses =
    size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'

  const variantClasses =
    variant === 'default'
      ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
      : 'bg-gray-100/50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-500'

  return (
    <kbd
      className={`font-sans font-medium rounded ${sizeClasses} ${variantClasses} ${className}`}
    >
      {formatShortcutForDisplay(shortcut)}
    </kbd>
  )
}
