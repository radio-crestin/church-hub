/**
 * Payload for dragging a song out of the song list and onto a side panel
 * (Marcaje or Programe).
 *
 * This uses the native HTML5 drag-and-drop API rather than dnd-kit on purpose:
 * both panels already run their own `DndContext` for drag-to-reorder, and
 * nesting a second context around the virtualized list to carry items *between*
 * containers makes the two fight over pointer sensors. Native DnD is a separate
 * channel, so list→panel drags and in-panel reordering never interfere.
 */

/** Custom MIME type so only our own drags are accepted by the panels. */
export const SONG_DRAG_MIME = 'application/x-church-hub-song'

export interface SongDragPayload {
  id: number
  title: string
}

/**
 * Whether a song is being dragged *inside* the app right now.
 *
 * The file-import provider has to tell two situations apart: the operator
 * moving a song from the list onto a panel, and the operator bringing a file in
 * from outside the app. Inspecting `dataTransfer` is not enough to do that —
 * the provider also listens on Tauri's `onDragDropEvent`, which reports an OS
 * drag session with no DOM `dataTransfer` to look at. So the app states the
 * fact explicitly for the lifetime of its own drag, and the provider asks.
 *
 * Module-level rather than React state on purpose: it is read from event
 * handlers and Tauri callbacks that are not part of any render.
 */
let internalDragActive = false
/**
 * The song being dragged. `dataTransfer` is the primary channel, but it is not
 * readable during `dragover` in every engine, and a webview can hand back an
 * empty payload on `drop`. Keeping the song here too means the drop target can
 * always answer "which song is this?".
 */
let internalDragPayload: SongDragPayload | null = null
const listeners = new Set<(active: boolean) => void>()

/** Safety net for drags that end without a `dragend` (cancelled off-window). */
let internalDragTimer: ReturnType<typeof setTimeout> | null = null

function setInternalDragActive(active: boolean): void {
  if (internalDragActive === active) return
  internalDragActive = active
  for (const listener of listeners) listener(active)
}

/** True while a song is being dragged from one part of the app to another. */
export function isInternalSongDragActive(): boolean {
  return internalDragActive
}

/** The song currently being dragged inside the app, if any. */
export function getInternalSongDragPayload(): SongDragPayload | null {
  return internalDragPayload
}

/** Notified whenever an internal song drag starts or ends. */
export function subscribeInternalSongDrag(
  listener: (active: boolean) => void,
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Ends the current internal drag, if any. */
export function endInternalSongDrag(): void {
  if (internalDragTimer) {
    clearTimeout(internalDragTimer)
    internalDragTimer = null
  }
  internalDragPayload = null
  setInternalDragActive(false)
}

/**
 * Attaches a song to a native drag and marks the drag as internal. Call from
 * `onDragStart`; pair it with `endInternalSongDrag` on `onDragEnd`.
 */
export function setSongDragData(
  event: React.DragEvent,
  song: SongDragPayload,
): void {
  event.dataTransfer.setData(SONG_DRAG_MIME, JSON.stringify(song))
  // A plain-text fallback keeps the drag meaningful if it lands outside the app.
  event.dataTransfer.setData('text/plain', song.title)
  event.dataTransfer.effectAllowed = 'copy'

  internalDragPayload = song
  setInternalDragActive(true)
  if (internalDragTimer) clearTimeout(internalDragTimer)
  // No drag realistically outlives this; without it a drag cancelled outside
  // the window would leave the app permanently believing one is in flight.
  internalDragTimer = setTimeout(endInternalSongDrag, 30_000)
}

/**
 * True when a drag currently in flight carries one of our songs. `getData` is
 * deliberately unreadable during `dragover` for security, so hover feedback can
 * only inspect the type list — which is exactly what this checks.
 */
export function isSongDrag(event: React.DragEvent): boolean {
  return (
    internalDragActive ||
    Array.from(event.dataTransfer.types).includes(SONG_DRAG_MIME)
  )
}

/** Reads the dragged song on `drop`. Returns null for foreign drags. */
export function readSongDragData(
  event: React.DragEvent,
): SongDragPayload | null {
  const raw = event.dataTransfer.getData(SONG_DRAG_MIME)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as SongDragPayload
      if (typeof parsed?.id === 'number') return parsed
    } catch {
      // Fall through to the in-flight payload below.
    }
  }
  // A drag we started ourselves is still identifiable even when the transfer
  // comes back empty.
  return internalDragPayload
}
