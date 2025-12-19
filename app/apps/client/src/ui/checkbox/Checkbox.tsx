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
          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-white dark:focus:ring-offset-gray-900"
        />
        {label && (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {label}
          </span>
        )}
      </label>
    )
  },
)

Checkbox.displayName = 'Checkbox'
