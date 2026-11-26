import type { ReactNode } from 'react'

interface PagePanelProps {
  children: ReactNode
  testId?: string
}

/**
 * The surface a page's content sits on (like the songs list): white, or gray
 * in dark mode, bordered; it scrolls inside on a large screen.
 */
export function PagePanel({ children, testId }: PagePanelProps) {
  return (
    <div
      data-testid={testId}
      className="flex min-h-0 flex-1 flex-col gap-3 rounded-xl border border-line bg-panel p-3 lg:overflow-y-auto"
    >
      {children}
    </div>
  )
}
