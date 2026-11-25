import { SyncError } from '../SyncError'
import type { ChurchState, SyncStore } from './ChurchState'
import { type ChurchVersion, readChurch } from './readChurch'
import { writeChurch } from './writeChurch'

/** A change that keeps losing the race to concurrent ones gives up (503). */
const MAX_ATTEMPTS = 8

/** Waits a random, growing while, so racing writers stop colliding. */
function backOff(attempt: number): Promise<void> {
  const ms = (attempt + 1) * (20 + Math.random() * 80)
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface ChurchChange<T> {
  /** The state to save (the one given, changed in place, is fine). */
  next: ChurchState
  result: T
  /** Undoes the change's own uploads when another write won the race. */
  undo?: () => Promise<void>
}

/**
 * Applies `change` to the church's latest state and saves it only if
 * nobody wrote in between (If-Match on the state's ETag); otherwise reads
 * again and retries, after `undo`. `change` may throw a SyncError to refuse
 * (403, 409…), or return null when there is nothing to save. `first`: a
 * state the caller has just read, used for the first attempt.
 */
export async function updateChurch<T>(
  store: SyncStore,
  churchId: string,
  change: (state: ChurchState) => Promise<ChurchChange<T> | null>,
  first?: ChurchVersion
): Promise<{ state: ChurchState; etag: string; result: T | null }> {
  let current = first
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const read = current ?? (await readChurch(store, churchId))
    current = undefined
    if (!read) throw new SyncError(404, 'not_found', 'No such church')

    const changed = await change(read.state)
    if (!changed) return { ...read, result: null }
    const etag = await writeChurch(store, changed.next, read.etag)
    if (etag !== null) {
      return { state: changed.next, etag, result: changed.result }
    }
    await changed.undo?.()
    await backOff(attempt)
  }
  throw new SyncError(503, 'busy', 'Too many concurrent writes, try again')
}
