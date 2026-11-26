import type { ScheduleItem } from './types'

/**
 * A presentation's items as they run: each `schedule` item replaced by its
 * presentation's items, at any depth. A presentation already being walked is
 * skipped, so a loop in old or synced data can never hang it.
 */
export function flattenScheduleItems(
  items: ScheduleItem[],
  path: ReadonlySet<number> = new Set(),
): ScheduleItem[] {
  return items.flatMap((item) => {
    if (item.itemType !== 'schedule') return [item]
    const child = item.childSchedule
    if (!child || path.has(child.id)) return []
    return flattenScheduleItems(child.items, new Set(path).add(child.id))
  })
}
