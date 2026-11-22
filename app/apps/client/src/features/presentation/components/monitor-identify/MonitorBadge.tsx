import { useEffect } from 'react'

import { BADGE_MS } from '../../utils/identifyMonitors'
import { isTauri } from '../../utils/openDisplayWindow'

interface MonitorBadgeProps {
  /** The monitor's place in the list the screen settings show. */
  number: number
  /** The OS's name for the monitor, as the list shows it, when it has one. */
  name?: string
  /** The monitor's resolution, as the list shows it. */
  size?: string
}

/**
 * The whole of a badge window: a black plate with the monitor's number, name
 * and resolution on it, centred, sized to the window so it reads the same on
 * a laptop and on a projector.
 *
 * Its own window is the plate, so this only has to fill it — no chrome, no
 * providers, nothing that reaches for the app's data. It shows itself once it
 * has drawn and takes itself away {@link BADGE_MS} later.
 */
export function MonitorBadge({ number, name, size }: MonitorBadgeProps) {
  useEffect(() => {
    if (!isTauri()) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const showThenClose = async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const badge = getCurrentWindow()
      // Built hidden: it comes up only once its number is on screen.
      await new Promise(requestAnimationFrame)
      await badge.show()
      timer = setTimeout(() => {
        badge.close().catch(logBadgeError)
      }, BADGE_MS)
    }
    showThenClose().catch(logBadgeError)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      data-testid="monitor-badge"
      className="w-screen h-screen flex flex-col items-center justify-center gap-[3vmin] bg-black text-white select-none overflow-hidden border-[1.5vmin] border-indigo-500"
    >
      <span
        data-testid="monitor-badge-number"
        className="font-semibold leading-none text-[50vmin]"
      >
        {number}
      </span>
      {name ? (
        <span
          data-testid="monitor-badge-name"
          className="max-w-[90vw] truncate text-[8vmin] font-medium leading-tight"
        >
          {name}
        </span>
      ) : null}
      {size ? (
        <span
          data-testid="monitor-badge-size"
          className="text-[6vmin] leading-tight text-gray-400"
        >
          {size}
        </span>
      ) : null}
    </div>
  )
}

function logBadgeError(error: unknown) {
  // biome-ignore lint/suspicious/noConsole: Error logging
  console.error('[MonitorBadge] Failed to show or close the badge:', error)
}
