import { useCallback, useSyncExternalStore } from 'react'

import type { CopiedPosition } from './CopiedPosition'

const STORAGE_KEY = 'screen-editor:copied-position'
const CHANGE_EVENT = 'screen-editor:copied-position-change'

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

const read = () => localStorage.getItem(STORAGE_KEY)

/**
 * The position copied in the screen editor. It is kept in local storage, so
 * it can be pasted on another slide type, another screen, or after the
 * editor was closed and opened again.
 */
export function usePositionClipboard() {
  const stored = useSyncExternalStore(subscribe, read, () => null)
  const copied: CopiedPosition | null = stored ? JSON.parse(stored) : null

  const copy = useCallback((position: CopiedPosition) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(position))
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return { copied, copy }
}
