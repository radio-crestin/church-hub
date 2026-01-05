/**
 * Last visited page localStorage service
 * Stores the last visited page state per section (songs, bible, schedules)
 * This allows restoring the user's previous position when returning to a section
 */

const STORAGE_KEY = 'church-hub-last-visited'

/**
 * State for the songs section
 */
export interface SongsLastVisited {
  songId?: number
  searchQuery?: string
}

/**
 * State for the Bible section
 */
export interface BibleLastVisited {
  translationId?: number
  bookId?: number
  bookName?: string
  chapter?: number
  verseIndex?: number
}

/**
 * State for the schedules section
 */
export interface SchedulesLastVisited {
  scheduleId?: number
}

/**
 * Combined last visited state
 */
export interface LastVisitedState {
  songs?: SongsLastVisited
  bible?: BibleLastVisited
  schedules?: SchedulesLastVisited
}

/**
 * Gets the entire last visited state from localStorage
 */
export function getLastVisitedState(): LastVisitedState {
  if (typeof window === 'undefined') return {}

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return {}
    return JSON.parse(stored) as LastVisitedState
  } catch {
    return {}
  }
}

/**
 * Sets the entire last visited state to localStorage
 */
function setLastVisitedState(state: LastVisitedState): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage errors are not critical - silently fail
  }
}

/**
 * Gets the last visited songs state
 */
export function getSongsLastVisited(): SongsLastVisited | undefined {
  return getLastVisitedState().songs
}

/**
 * Sets the last visited songs state
 */
export function setSongsLastVisited(state: SongsLastVisited | undefined): void {
  const current = getLastVisitedState()
  setLastVisitedState({ ...current, songs: state })
}

/**
 * Gets the last visited Bible state
 */
export function getBibleLastVisited(): BibleLastVisited | undefined {
  return getLastVisitedState().bible
}

/**
 * Sets the last visited Bible state
 */
export function setBibleLastVisited(state: BibleLastVisited | undefined): void {
  const current = getLastVisitedState()
  setLastVisitedState({ ...current, bible: state })
}

/**
 * Gets the last visited schedules state
 */
export function getSchedulesLastVisited(): SchedulesLastVisited | undefined {
  return getLastVisitedState().schedules
}

/**
 * Sets the last visited schedules state
 */
export function setSchedulesLastVisited(
  state: SchedulesLastVisited | undefined,
): void {
  const current = getLastVisitedState()
  setLastVisitedState({ ...current, schedules: state })
}

/**
 * Clears all last visited state
 */
export function clearLastVisitedState(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Silently fail
  }
}

/**
 * Clears a specific section's last visited state
 */
export function clearSectionLastVisited(
  section: 'songs' | 'bible' | 'schedules',
): void {
  const current = getLastVisitedState()
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete current[section]
  setLastVisitedState(current)
}
