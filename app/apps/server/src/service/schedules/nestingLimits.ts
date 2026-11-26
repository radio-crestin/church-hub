import { sql } from 'drizzle-orm'

import { childScheduleIds } from './childScheduleIds'
import { getDatabase } from '../../db'
import { scheduleItems } from '../../db/schema'

/** How many levels of presentations inside presentations one can hold. */
export const MAX_NESTING_DEPTH = 5
/** How many items one presentation can run, counting those inside it. */
export const MAX_EXPANDED_ITEMS = 1000

function itemCounts(): Map<number, number> {
  const rows = getDatabase()
    .select({
      scheduleId: scheduleItems.scheduleId,
      count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
    })
    .from(scheduleItems)
    .groupBy(scheduleItems.scheduleId)
    .all()
  return new Map(rows.map((r) => [r.scheduleId, r.count]))
}

interface Measure {
  /** Levels of presentations inside it (0: none). */
  depth: number
  /** Items it runs, those inside it included. */
  size: number
}

/**
 * What adding presentation `childId` to `scheduleId` would break, or null:
 * it, or any presentation holding it, would nest too deep or run too many
 * items. Each presentation is measured once, so a presentation held many
 * times over is cheap to check.
 */
export function nestingProblem(
  scheduleId: number,
  childId: number,
): string | null {
  const children = childScheduleIds()
  const counts = itemCounts()
  children.set(scheduleId, [...(children.get(scheduleId) ?? []), childId])
  counts.set(scheduleId, (counts.get(scheduleId) ?? 0) + 1)

  const memo = new Map<number, Measure>()
  const onPath = new Set<number>()
  const measure = (id: number): Measure => {
    const known = memo.get(id)
    if (known) return known
    // A loop in old data counts for nothing rather than forever.
    if (onPath.has(id)) return { depth: 0, size: 0 }
    onPath.add(id)
    let depth = 0
    let size = counts.get(id) ?? 0
    for (const child of children.get(id) ?? []) {
      const inner = measure(child)
      depth = Math.max(depth, inner.depth + 1)
      size += inner.size
    }
    onPath.delete(id)
    const result = { depth, size }
    memo.set(id, result)
    return result
  }

  // The presentation and every one holding it grow with the new item.
  const parents = new Map<number, number[]>()
  for (const [parent, list] of children) {
    for (const child of list) {
      parents.set(child, [...(parents.get(child) ?? []), parent])
    }
  }
  const affected = new Set<number>()
  const pending = [scheduleId]
  while (pending.length > 0) {
    const id = pending.pop() as number
    if (affected.has(id)) continue
    affected.add(id)
    pending.push(...(parents.get(id) ?? []))
  }

  for (const id of affected) {
    const { depth, size } = measure(id)
    if (depth > MAX_NESTING_DEPTH) {
      return `Presentations can hold others at most ${MAX_NESTING_DEPTH} levels deep`
    }
    if (size > MAX_EXPANDED_ITEMS) {
      return `A presentation can run at most ${MAX_EXPANDED_ITEMS} items, counting those inside it`
    }
  }
  return null
}
