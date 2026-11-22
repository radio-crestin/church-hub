import type { ReactNode } from 'react'

/** Short settings side by side on a wide screen, one under the other below. */
export function SettingFieldRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-6 xl:grid-cols-2">{children}</div>
}
