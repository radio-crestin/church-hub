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
      <label htmlFor={id} className="block text-[13px] font-medium text-fg">
        {label}
      </label>
      {description && (
        <p className="mt-0.5 mb-2 text-xs text-fg-hint">{description}</p>
      )}
      <div className={description ? '' : 'mt-2'}>{children(id)}</div>
    </div>
  )
}
