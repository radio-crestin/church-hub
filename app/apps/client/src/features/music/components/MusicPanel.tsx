import type { ReactNode } from 'react'

/**
 * The card each part of the Music page sits in (library, tracks, player,
 * queue); its sections are split by hairlines.
 */
export function MusicPanel({
  children,
  testId,
}: {
  children: ReactNode
  testId?: string
}) {
  return (
    <div
      data-testid={testId}
      className="w-full min-w-0 flex flex-col overflow-hidden divide-y divide-line lg:flex-1 lg:min-h-0 bg-panel rounded-xl border border-line"
    >
      {children}
    </div>
  )
}
