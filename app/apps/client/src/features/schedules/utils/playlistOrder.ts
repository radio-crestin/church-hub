import { isAutomationOn } from './isAutomationOn'
import type { Schedule } from '../types'

/** How many of the latest presentations the playlist shows besides the pinned ones. */
const RECENT_COUNT = 3

export interface PlaylistOrder {
  /** Shown at once: the pinned ones, those that run by themselves, the latest. */
  shown: Schedule[]
  /** Behind "Show all", in the same most-recent-first order. */
  hidden: Schedule[]
}

/**
 * The control room's playlist: the presentations given in `pinnedIds` first
 * (the one on the screens, the one running), then every presentation with
 * automation on, then the latest few. `schedules` come most recent first.
 */
export function playlistOrder(
  schedules: Schedule[],
  pinnedIds: (number | null | undefined)[],
): PlaylistOrder {
  const byId = new Map(schedules.map((s) => [s.id, s]))
  const shown: Schedule[] = []
  const add = (schedule: Schedule | undefined) => {
    if (schedule && !shown.includes(schedule)) shown.push(schedule)
  }

  for (const id of pinnedIds) if (id != null) add(byId.get(id))
  for (const s of schedules) if (isAutomationOn(s.automation)) add(s)
  schedules
    .filter((s) => !shown.includes(s))
    .slice(0, RECENT_COUNT)
    .forEach(add)

  return { shown, hidden: schedules.filter((s) => !shown.includes(s)) }
}
