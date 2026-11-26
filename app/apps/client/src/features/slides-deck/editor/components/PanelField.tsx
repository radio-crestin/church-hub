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
      <span className="text-sm text-fg-label">{label}</span>
      {children}
    </label>
  )
}
