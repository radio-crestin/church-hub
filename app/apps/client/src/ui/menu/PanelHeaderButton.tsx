import type { ButtonHTMLAttributes } from 'react'

interface PanelHeaderButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Pressed state, such as an open search. */
  active?: boolean
}

/**
 * An icon button in a panel header row (Marcaje, Programe). It is as big as
 * the "More" trigger beside it, so the row keeps as many actions inline as
 * the column has room for. Give it a 14px icon with a 1.75 stroke.
 */
export function PanelHeaderButton({
  active = false,
  type = 'button',
  className = '',
  ...props
}: PanelHeaderButtonProps) {
  const tone = active
    ? 'bg-selected text-fg'
    : 'text-fg-label hover:bg-hover hover:text-fg'
  return (
    <button
      type={type}
      className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-50 ${tone} ${className}`}
      {...props}
    />
  )
}
