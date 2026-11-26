import type { ScheduleVideoPick } from './types'
import type { ScheduleVerseteTineriEntry } from '../schedules/types'

interface ItemPick {
  /** What it was picked from: new settings or passages pick again. */
  basis: string
  entries?: ScheduleVerseteTineriEntry[]
  video?: ScheduleVideoPick | null
}

/**
 * What each random item shows in the current run, by item id. Kept in memory:
 * every page sees the same picks until the presentation starts or loops again
 * (`forgetItemPicks`), so the list and the screens never disagree.
 */
const picks = new Map<number, ItemPick>()

function remembered<K extends 'entries' | 'video'>(
  itemId: number,
  basis: unknown,
  key: K,
  make: () => ItemPick[K],
): ItemPick[K] {
  const basisJson = JSON.stringify(basis)
  const current = picks.get(itemId)
  if (current?.basis === basisJson && key in current) return current[key]
  const next: ItemPick = { basis: basisJson, [key]: make() }
  picks.set(itemId, next)
  return next[key]
}

/** The passages an item shows this run, picked by `make` once per run. */
export function pickedEntries(
  itemId: number,
  basis: unknown,
  make: () => ScheduleVerseteTineriEntry[],
): ScheduleVerseteTineriEntry[] {
  return remembered(itemId, basis, 'entries', make) ?? []
}

/** The video an item shows this run, picked by `make` once per run. */
export function pickedVideo(
  itemId: number,
  basis: unknown,
  make: () => ScheduleVideoPick | null,
): ScheduleVideoPick | null {
  return remembered(itemId, basis, 'video', make) ?? null
}

/** The items pick again the next time they are read. */
export function forgetItemPicks(itemIds: number[]): void {
  for (const id of itemIds) picks.delete(id)
}
