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
    size === 'sm'
      ? 'h-[18px] min-w-5 px-[5px] text-[11px] leading-[18px]'
      : 'h-[22px] min-w-6 px-1.5 text-xs leading-[22px]'

  const variantClasses =
    variant === 'default' ? 'text-fg-label' : 'text-fg-hint'

  // A touch screen has no keys to press: the hint only takes room there.
  return (
    <kbd
      className={`inline-flex items-center justify-center box-border font-sans font-medium rounded-[5px] bg-keycap shadow-[inset_0_0_0_1px_var(--color-keycap-ring)] [@media(hover:none)]:hidden ${sizeClasses} ${variantClasses} ${className}`}
    >
      {formatShortcutForDisplay(shortcut)}
    </kbd>
  )
}
