/**
 * Remembers the operator's last picked program. Deliberately one key for every
 * page: picking a program on the song page and walking into the Bible page
 * should land on the same program.
 */
const SELECTED_SCHEDULE_STORAGE_KEY = 'songPage.selectedScheduleId'

/** Fires in this tab whenever the selection changes; `storage` covers others. */
const SELECTED_SCHEDULE_EVENT = 'churchhub:selected-schedule-changed'

/**
 * The program the Programe panel currently has selected. Exported so a page
 * toolbar — or a page's next/prev handlers — can act on the same selection
 * without mirroring it into their own state.
 */
export function readSelectedScheduleId(): number | null {
  try {
    const stored = localStorage.getItem(SELECTED_SCHEDULE_STORAGE_KEY)
    if (!stored) return null
    const parsed = Number(stored)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  } catch {
    return null
  }
}

/**
 * Persists the panel's selection and tells the rest of the page about it, so a
 * page that navigates through the program picks up the change immediately
 * instead of waiting for its next render.
 */
export function writeSelectedScheduleId(scheduleId: number | null): void {
  try {
    if (scheduleId) {
      localStorage.setItem(SELECTED_SCHEDULE_STORAGE_KEY, String(scheduleId))
    } else {
      localStorage.removeItem(SELECTED_SCHEDULE_STORAGE_KEY)
    }
  } catch {
    // localStorage unavailable (private mode) — selection just won't persist.
  }
  window.dispatchEvent(new Event(SELECTED_SCHEDULE_EVENT))
}

/** Subscribes to selection changes made in this tab or in another one. */
export function subscribeSelectedScheduleId(onChange: () => void): () => void {
  window.addEventListener(SELECTED_SCHEDULE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(SELECTED_SCHEDULE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}
