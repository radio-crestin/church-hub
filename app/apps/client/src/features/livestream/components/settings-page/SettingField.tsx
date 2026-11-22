import { type ReactNode, useId } from 'react'

interface SettingFieldProps {
  label: string
  /** One line on what the setting does. */
  description?: ReactNode
  /** The control; gets `id` so the label names it. */
  children: (id: string) => ReactNode
}

/** A setting with a value to type or pick: its name, what it does, the control. */
export function SettingField({
  label,
  description,
  children,
}: SettingFieldProps) {
  const id = useId()

  return (
    <div className="py-2">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-900 dark:text-gray-100"
      >
        {label}
      </label>
      {description && (
        <p className="mt-0.5 mb-2 text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
      <div className={description ? '' : 'mt-2'}>{children(id)}</div>
    </div>
  )
}
