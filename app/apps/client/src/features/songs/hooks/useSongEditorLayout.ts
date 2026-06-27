import { useSyncExternalStore } from 'react'

/**
 * Per-device preference for how songs are edited:
 * - 'normal'     → the existing form / first-column slide editing.
 * - 'powerpoint' → the PowerPoint-style stage editor shown directly on the song
 *                  page (filmstrip + editable canvas).
 *
 * Stored in localStorage (per-machine, never synced to the DB — like divider
 * positions). Backed by a tiny external store so every component that reads it
 * (settings panel, song page, editor) updates the moment it changes, in this tab
 * and across tabs.
 */
export type SongEditorLayout = 'normal' | 'powerpoint'

const STORAGE_KEY = 'song-editor-layout'
const listeners = new Set<() => void>()

function readLayout(): SongEditorLayout {
  if (typeof window === 'undefined') return 'normal'
  return window.localStorage.getItem(STORAGE_KEY) === 'powerpoint'
    ? 'powerpoint'
    : 'normal'
}

export function setSongEditorLayout(layout: SongEditorLayout): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, layout)
  } catch {
    // Ignore quota/availability errors — non-critical UI state.
  }
  for (const listener of listeners) listener()
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onStorage)
  }
}

export function useSongEditorLayout(): [
  SongEditorLayout,
  (layout: SongEditorLayout) => void,
] {
  const layout = useSyncExternalStore(
    subscribe,
    readLayout,
    (): SongEditorLayout => 'normal',
  )
  return [layout, setSongEditorLayout]
}
