import type { ReactNode } from 'react'

interface PageProps {
  children: ReactNode
  testId?: string
}

/**
 * A top-level page: its header, then its content, one gap apart, filling the
 * window on a large screen. The app layout already pads it.
 */
export function Page({ children, testId }: PageProps) {
  return (
    <div data-testid={testId} className="flex min-h-0 flex-col gap-4 lg:h-full">
      {children}
    </div>
  )
}
