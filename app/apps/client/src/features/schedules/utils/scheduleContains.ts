import type { Schedule } from '../types'

/**
 * Whether presentation `rootId` is `targetId` or plays it, directly or
 * through the presentations it plays (as the server checks before adding).
 */
export function scheduleContains(
  schedules: Schedule[],
  rootId: number,
  targetId: number,
): boolean {
  const children = new Map(schedules.map((s) => [s.id, s.childScheduleIds]))
  const visited = new Set<number>()
  const pending = [rootId]
  while (pending.length > 0) {
    const id = pending.pop() as number
    if (id === targetId) return true
    if (visited.has(id)) continue
    visited.add(id)
    pending.push(...(children.get(id) ?? []))
  }
  return false
}
