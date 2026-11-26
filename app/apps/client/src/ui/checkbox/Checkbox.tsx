import { forwardRef } from 'react'

interface CheckboxProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
  id?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, onCheckedChange, label, disabled, className = '', id }, ref) => {
    const inputId = id || `checkbox-${Math.random().toString(36).slice(2, 9)}`

    return (
      <label
        htmlFor={inputId}
        className={`flex items-center gap-2 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      >
        <input
          ref={ref}
          type="checkbox"
          id={inputId}
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          disabled={disabled}
          className="w-4 h-4 rounded accent-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
        {label && <span className="text-[13px] text-fg-body">{label}</span>}
      </label>
    )
  },
)

Checkbox.displayName = 'Checkbox'
