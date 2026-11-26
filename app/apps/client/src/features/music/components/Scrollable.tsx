import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import type { ReactNode } from 'react'
import 'overlayscrollbars/overlayscrollbars.css'

/**
 * Scrolls its content inside the panel with a thin overlay scrollbar; when
 * not enabled (a phone), the page itself scrolls.
 */
export function Scrollable({
  enabled,
  children,
}: {
  enabled: boolean
  children: ReactNode
}) {
  if (!enabled) return children
  return (
    <OverlayScrollbarsComponent
      className="lg:flex-1 lg:min-h-0"
      options={{ scrollbars: { autoHide: 'scroll', autoHideDelay: 400 } }}
      defer
    >
      {children}
    </OverlayScrollbarsComponent>
  )
}
