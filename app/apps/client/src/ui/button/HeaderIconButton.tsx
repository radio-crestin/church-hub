import { type ButtonHTMLAttributes, forwardRef } from 'react'

import { Tooltip } from '../tooltip'

interface HeaderIconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Its accessible name, and the tooltip unless `tooltip` says more. */
  label: string
  tooltip?: string
  /** A toggle's state; leave it out for a plain action. */
  pressed?: boolean
}

/**
 * An icon-only button in a panel header: 32px (44px on a phone), its name in
 * a tooltip, a grey fill while a toggle is on, and the hover fill while its
 * popover is open (which then hides the tooltip). Give it a 16px icon with a
 * 1.5 stroke.
 */
export const HeaderIconButton = forwardRef<
  HTMLButtonElement,
  HeaderIconButtonProps
>(({ label, tooltip, pressed, className = '', ...props }, ref) => {
  const expanded = props['aria-expanded'] === true
  return (
    <Tooltip content={expanded ? '' : (tooltip ?? label)} position="bottom">
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        className={`flex h-11 w-11 flex-none items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus disabled:opacity-40 md:h-8 md:w-8 ${
          pressed
            ? 'bg-selected text-fg'
            : expanded
              ? 'bg-hover text-fg'
              : 'text-fg-label hover:bg-hover hover:text-fg'
        } ${className}`}
        {...props}
      />
    </Tooltip>
  )
})

HeaderIconButton.displayName = 'HeaderIconButton'
