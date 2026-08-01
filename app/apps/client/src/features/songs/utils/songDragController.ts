/**
 * Dragging a song from the list onto a side panel (Marcaje / Programe).
 *
 * Built on pointer events rather than the native HTML5 drag-and-drop API. Two
 * reasons, both learned the hard way:
 *
 *  - The desktop build runs in WKWebView on macOS, where a native drag started
 *    from a nested element is unreliable and `dataTransfer` silently drops
 *    custom MIME types — so the drop target could not tell what it was being
 *    handed, and often never got the chance to accept it at all.
 *  - Native drags are the same channel the file-import provider listens on, so
 *    an internal drag kept raising the "drop PowerPoint files here" overlay.
 *
 * Pointer events sidestep both: no drag events are emitted, so the import
 * provider never sees anything, and the payload never leaves this module.
 */

export interface SongDragPayload {
  id: number
  title: string
}

export interface SongDragState {
  song: SongDragPayload | null
  /** Viewport coordinates of the pointer, for the floating preview. */
  x: number
  y: number
  /** Id of the drop zone under the pointer, if any. */
  activeZoneId: string | null
}

type Listener = (state: SongDragState) => void

interface DropZone {
  element: HTMLElement
  onDrop: (song: SongDragPayload) => void
}

const IDLE: SongDragState = { song: null, x: 0, y: 0, activeZoneId: null }

let state: SongDragState = IDLE
const listeners = new Set<Listener>()
const zones = new Map<string, DropZone>()
let zoneSeq = 0

function emit(): void {
  for (const listener of listeners) listener(state)
}

function setState(next: Partial<SongDragState>): void {
  state = { ...state, ...next }
  emit()
}

export function getSongDragState(): SongDragState {
  return state
}

export function subscribeSongDrag(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Registers a drop target. Returns both its id — the caller compares it with
 * `activeZoneId` to know it is being hovered — and the unregister function.
 */
export function registerSongDropZone(
  element: HTMLElement,
  onDrop: (song: SongDragPayload) => void,
): { id: string; unregister: () => void } {
  zoneSeq += 1
  const id = `song-drop-zone-${zoneSeq}`
  zones.set(id, { element, onDrop })
  return {
    id,
    unregister: () => {
      zones.delete(id)
      if (state.activeZoneId === id) setState({ activeZoneId: null })
    },
  }
}

/** The registered zone under a viewport point, if any. */
function zoneAt(x: number, y: number): string | null {
  const target = document.elementFromPoint(x, y)
  if (!target) return null
  for (const [id, zone] of zones) {
    if (zone.element === target || zone.element.contains(target)) return id
  }
  return null
}

/**
 * Starts a drag. Call from `pointerdown` on the grip.
 *
 * The gesture only becomes a drag after the pointer travels a few pixels, so a
 * plain click on the grip still does nothing.
 */
export function startSongDrag(
  event: React.PointerEvent,
  song: SongDragPayload,
): void {
  const startX = event.clientX
  const startY = event.clientY
  const pointerId = event.pointerId
  let armed = false

  const move = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== pointerId) return
    if (!armed) {
      const travelled =
        Math.abs(moveEvent.clientX - startX) +
        Math.abs(moveEvent.clientY - startY)
      if (travelled < 6) return
      armed = true
      // Suppress the text selection the pointer would otherwise paint while
      // the ghost is being dragged across the page.
      document.body.style.userSelect = 'none'
      setState({ song, x: moveEvent.clientX, y: moveEvent.clientY })
    }
    setState({
      x: moveEvent.clientX,
      y: moveEvent.clientY,
      activeZoneId: zoneAt(moveEvent.clientX, moveEvent.clientY),
    })
  }

  const finish = (commit: boolean) => {
    document.removeEventListener('pointermove', move)
    document.removeEventListener('pointerup', up)
    document.removeEventListener('pointercancel', cancel)
    document.removeEventListener('keydown', onKeyDown)
    document.body.style.userSelect = ''

    const zoneId = state.activeZoneId
    const dragged = state.song
    state = IDLE
    emit()

    if (commit && zoneId && dragged) {
      zones.get(zoneId)?.onDrop(dragged)
    }
  }

  const up = (upEvent: PointerEvent) => {
    if (upEvent.pointerId !== pointerId) return
    finish(armed)
  }
  const cancel = () => finish(false)
  const onKeyDown = (keyEvent: KeyboardEvent) => {
    if (keyEvent.key === 'Escape') finish(false)
  }

  document.addEventListener('pointermove', move)
  document.addEventListener('pointerup', up)
  document.addEventListener('pointercancel', cancel)
  document.addEventListener('keydown', onKeyDown)
}
