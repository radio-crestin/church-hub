import type { ReactNode } from 'react'

/** A labelled control in the editor's panel. */
export function PanelField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      {children}
    </label>
  )
}
