import { useEffect, useRef, useState } from 'react'

import type { WorkspacePanel } from '../types'

interface WorkspaceTabsProps {
  panels: WorkspacePanel[]
  /** The open tab, when the page picks it (see Workspace's `activeTab`). */
  activeTab?: string
  onActiveTabChange?: (id: string) => void
  className?: string
}

/**
 * A workspace on a phone: `pinned` panels (the preview) stay at the top of the
 * screen while the page scrolls, and every other panel is one tab under them,
 * so each one has the whole width instead of a long stack.
 *
 * Once the page scrolls past its top, the pinned area carries
 * `data-stuck="true"`: a pinned panel can shrink itself with the
 * `group-data-[stuck=true]/pinned:` variants, keeping what is live in view
 * while giving the room back to the tab below.
 */
export function WorkspaceTabs({
  panels,
  activeTab,
  onActiveTabChange,
  className = '',
}: WorkspaceTabsProps) {
  const pinned = panels.filter((panel) => panel.pinned)
  const tabs = panels.filter((panel) => !panel.pinned)
  const [ownActiveId, setOwnActiveId] = useState(tabs[0]?.id)
  const activeId = activeTab ?? ownActiveId
  const setActiveId = onActiveTabChange ?? setOwnActiveId
  const active = tabs.find((panel) => panel.id === activeId) ?? tabs[0]

  const sentinelRef = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(([entry]) =>
      setStuck(!entry.isIntersecting),
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  return (
    <div className={`flex flex-col ${className}`}>
      <div ref={sentinelRef} aria-hidden="true" className="h-px -mb-px" />
      <div
        data-stuck={stuck}
        data-sticky-header=""
        data-testid="workspace-pinned"
        className="group/pinned sticky top-0 z-20 -mx-3 px-3 pb-2 bg-app flex flex-col gap-2"
      >
        {pinned.map((panel) => (
          <div
            key={panel.id}
            data-testid={`workspace-panel-${panel.id}`}
            className="min-w-0"
          >
            {panel.render()}
          </div>
        ))}
        {tabs.length > 1 && (
          <div role="tablist" className="flex gap-1 p-1 rounded-lg bg-field">
            {tabs.map((panel) => (
              <button
                key={panel.id}
                type="button"
                role="tab"
                aria-selected={panel.id === active?.id}
                data-testid={`workspace-tab-${panel.id}`}
                onClick={() => setActiveId(panel.id)}
                className={`flex-1 min-w-0 truncate px-2 py-2 rounded-md text-[13px] font-medium transition-colors ${
                  panel.id === active?.id
                    ? 'bg-selected text-fg'
                    : 'text-fg-label hover:text-fg'
                }`}
              >
                {panel.title}
              </button>
            ))}
          </div>
        )}
      </div>
      {active && (
        <div
          role="tabpanel"
          data-testid={`workspace-panel-${active.id}`}
          className="min-w-0"
        >
          {active.render()}
        </div>
      )}
    </div>
  )
}
