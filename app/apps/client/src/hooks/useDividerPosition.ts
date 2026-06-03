import { useCallback, useState } from 'react'

/**
 * Drop-in replacement for `useState` that persists a resizable divider's
 * position (a percentage) to `localStorage`.
 *
 * The layout each operator configures is restored on every load and survives
 * an app restart, and it stays local to *this* machine: localStorage is
 * per-PC (and per app instance), so dragging a divider on one computer never
 * changes the layout on another. We deliberately do NOT round-trip through the
 * database — divider positions are a personal, per-device UI preference, not
 * shared application state.
 */
export function useDividerPosition(
  key: string,
  fallback: number,
): [number, (value: number) => void] {
  const [position, setPositionState] = useState(() => {
    if (typeof window === 'undefined') return fallback
    const cached = window.localStorage.getItem(key)
    const parsed = cached !== null ? Number(cached) : Number.NaN
    return Number.isFinite(parsed) ? parsed : fallback
  })

  const setPosition = useCallback(
    (value: number) => {
      setPositionState(value)
      try {
        window.localStorage.setItem(key, String(value))
      } catch {
        // Ignore quota/availability errors — non-critical UI state.
      }
    },
    [key],
  )

  return [position, setPosition]
}
