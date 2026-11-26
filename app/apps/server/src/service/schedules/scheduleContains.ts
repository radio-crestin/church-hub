import { childScheduleIds } from './childScheduleIds'

/**
 * Whether presentation `rootId` is `targetId` or plays it, directly or
 * through the presentations it plays. A visited set keeps old or synced data
 * that already loops from hanging the walk.
 */
export function scheduleContains(rootId: number, targetId: number): boolean {
  const children = childScheduleIds()
  const visited = new Set<number>()
  const pending = [rootId]
  while (pending.length > 0) {
    const id = pending.pop()!
    if (id === targetId) return true
    if (visited.has(id)) continue
    visited.add(id)
    pending.push(...(children.get(id) ?? []))
  }
  return false
}
