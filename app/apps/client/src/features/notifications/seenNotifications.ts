import { useSyncExternalStore } from 'react'

/**
 * The notifications this screen already showed as a pop-up, by id. Per
 * computer (localStorage): each screen pops a notification up once.
 */
const KEY = 'notifications-seen'
/** Old ids are dropped beyond this, so the list never grows without end. */
const MAX_IDS = 100

const listeners = new Set<() => void>()
let cache: string[] | null = null

function readSeen(): string[] {
  if (cache) return cache
  let ids: string[] = []
  try {
    ids = JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: a corrupt list starts empty
    console.warn('[notifications] Unreadable seen list', error)
  }
  cache = ids
  return ids
}

export function markSeen(id: string): void {
  const current = readSeen()
  if (current.includes(id)) return
  cache = [...current, id].slice(-MAX_IDS)
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: it then pops up again next time
    console.warn('[notifications] Could not save the seen list', error)
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The ids already shown as a pop-up; re-renders when it changes. */
export function useSeen(): string[] {
  return useSyncExternalStore(subscribe, readSeen)
}
