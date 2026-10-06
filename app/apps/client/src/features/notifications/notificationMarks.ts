import { useSyncExternalStore } from 'react'

/**
 * Which notifications the user has seen as a pop-up, read under the bell or
 * dismissed, by id. Per computer (localStorage): it is about this screen.
 */
type Mark = 'seen' | 'read' | 'dismissed'

const KEYS: Record<Mark, string> = {
  seen: 'notifications-seen',
  read: 'notifications-read',
  dismissed: 'notifications-dismissed',
}
/** Old ids are dropped beyond this, so the lists never grow without end. */
const MAX_IDS = 50

const listeners = new Set<() => void>()
const cache = new Map<Mark, string[]>()

function read(mark: Mark): string[] {
  const cached = cache.get(mark)
  if (cached) return cached
  let ids: string[] = []
  try {
    ids = JSON.parse(localStorage.getItem(KEYS[mark]) ?? '[]') as string[]
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: a corrupt list starts empty
    console.warn(`[notifications] Unreadable ${mark} list`, error)
  }
  cache.set(mark, ids)
  return ids
}

export function addMark(mark: Mark, ids: string[]): void {
  const current = read(mark)
  const fresh = ids.filter((id) => !current.includes(id))
  if (fresh.length === 0) return
  const next = [...current, ...fresh].slice(-MAX_IDS)
  cache.set(mark, next)
  localStorage.setItem(KEYS[mark], JSON.stringify(next))
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The ids with this mark; re-renders when it changes. */
export function useMarks(mark: Mark): string[] {
  return useSyncExternalStore(subscribe, () => read(mark))
}
