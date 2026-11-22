import { type ReactNode, useId } from 'react'

import { Switch } from './Switch'

interface SwitchRowProps {
  label: string
  /** One line on what turning it on does. */
  description?: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  testId?: string
}

/**
 * A setting that is on or off: its name and what it does on the left, the
 * switch on the right. The label and the description name the switch for
 * screen readers and tests.
 */
export function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  testId,
}: SwitchRowProps) {
  const id = useId()

  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <label
          id={`${id}-label`}
          htmlFor={id}
          className="block text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer"
        >
          {label}
        </label>
        {description && (
          <p
            id={`${id}-description`}
            className="mt-0.5 text-xs text-gray-500 dark:text-gray-400"
          >
            {description}
          </p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-description` : undefined}
        data-testid={testId}
        className="mt-0.5"
      />
    </div>
  )
}
