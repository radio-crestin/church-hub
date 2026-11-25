import type { ReactNode } from 'react'

/** The card the player's parts sit in. */
export function PlayerCard({ children }: { children: ReactNode }) {
  return (
    <div className="w-full min-w-0 flex flex-col overflow-hidden lg:flex-1 lg:min-h-0 bg-panel rounded-xl border border-line">
      {children}
    </div>
  )
}
