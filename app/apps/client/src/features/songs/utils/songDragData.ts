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

/** Attaches a song to a native drag. Call from `onDragStart`. */
export function setSongDragData(
  event: React.DragEvent,
  song: SongDragPayload,
): void {
  event.dataTransfer.setData(SONG_DRAG_MIME, JSON.stringify(song))
  // A plain-text fallback keeps the drag meaningful if it lands outside the app.
  event.dataTransfer.setData('text/plain', song.title)
  event.dataTransfer.effectAllowed = 'copy'
}

/**
 * True when a drag currently in flight carries one of our songs. `getData` is
 * deliberately unreadable during `dragover` for security, so hover feedback can
 * only inspect the type list — which is exactly what this checks.
 */
export function isSongDrag(event: React.DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes(SONG_DRAG_MIME)
}

/** Reads the dragged song on `drop`. Returns null for foreign drags. */
export function readSongDragData(
  event: React.DragEvent,
): SongDragPayload | null {
  const raw = event.dataTransfer.getData(SONG_DRAG_MIME)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SongDragPayload
    return typeof parsed?.id === 'number' ? parsed : null
  } catch {
    return null
  }
}
