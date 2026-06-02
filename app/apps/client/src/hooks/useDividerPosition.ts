import { useCallback, useEffect, useRef, useState } from 'react'

import { getDividerPosition, saveDividerPosition } from '~/service/layout'

// Debounce DB writes so dragging doesn't hammer the API on every mousemove.
const PERSIST_DEBOUNCE_MS = 400

/**
 * Drop-in replacement for `useState` that persists a resizable divider's
 * position (a percentage) to the database, so the layout is restored on every
 * load and across devices — always reflecting how the user last moved it.
 *
 * localStorage is used as an instant cache to avoid a layout flash before the
 * DB value arrives; the database is the source of truth and is written
 * (debounced) whenever the user drags the divider.
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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingValueRef = useRef<number | null>(null)

  // Reconcile the instant localStorage value with the DB source of truth.
  useEffect(() => {
    let cancelled = false
    void getDividerPosition(key, Number.NaN).then((value) => {
      if (cancelled || !Number.isFinite(value)) return
      setPositionState(value)
      window.localStorage.setItem(key, String(value))
    })
    return () => {
      cancelled = true
    }
  }, [key])

  // Flush any pending write on unmount so a quick drag-then-navigate persists.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (pendingValueRef.current !== null) {
        void saveDividerPosition(key, pendingValueRef.current)
      }
    }
  }, [key])

  const setPosition = useCallback(
    (value: number) => {
      setPositionState(value)
      window.localStorage.setItem(key, String(value))
      pendingValueRef.current = value
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        pendingValueRef.current = null
        void saveDividerPosition(key, value)
      }, PERSIST_DEBOUNCE_MS)
    },
    [key],
  )

  return [position, setPosition]
}
