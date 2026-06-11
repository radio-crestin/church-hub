import { useCallback, useRef, useState } from 'react'

import { ALPHABET_INDEX_LETTERS } from '../constants/alphabet'

interface UseAlphabetScrollOptions {
  /** Called with the letter the pointer is currently over (down + drag). */
  onSelectLetter: (letter: string) => void
}

interface UseAlphabetScrollReturn {
  /** Attach to the rail element — used to map pointer Y → letter. */
  railRef: React.RefObject<HTMLDivElement | null>
  /** Letter under the finger while dragging (drives the floating bubble). */
  indicatorLetter: string | null
  isDragging: boolean
  railHandlers: {
    onPointerDown: (event: React.PointerEvent) => void
    onPointerMove: (event: React.PointerEvent) => void
    onPointerUp: (event: React.PointerEvent) => void
    onPointerCancel: (event: React.PointerEvent) => void
  }
}

/**
 * Pure pointer-gesture layer for the alphabet rail: maps finger/cursor Y to a
 * letter, tracks the drag state and the bubble indicator, and reports the
 * targeted letter through `onSelectLetter`. It owns no scrolling — the caller
 * decides how to move the (virtualized) list — which keeps this hook cheap and
 * free of per-frame re-renders of the song list.
 */
export function useAlphabetScroll({
  onSelectLetter,
}: UseAlphabetScrollOptions): UseAlphabetScrollReturn {
  const railRef = useRef<HTMLDivElement | null>(null)
  const isDraggingRef = useRef(false)
  const indicatorRef = useRef<string | null>(null)

  const [indicatorLetter, setIndicatorLetter] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const setIndicator = useCallback((letter: string | null) => {
    indicatorRef.current = letter
    setIndicatorLetter(letter)
  }, [])

  const letterFromClientY = useCallback((clientY: number): string | null => {
    const rail = railRef.current
    if (!rail) return null
    const rect = rail.getBoundingClientRect()
    if (rect.height === 0) return null
    const ratio = Math.min(
      0.9999,
      Math.max(0, (clientY - rect.top) / rect.height),
    )
    const index = Math.floor(ratio * ALPHABET_INDEX_LETTERS.length)
    return ALPHABET_INDEX_LETTERS[index] ?? null
  }, [])

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault()
      const letter = letterFromClientY(event.clientY)
      if (!letter) return
      isDraggingRef.current = true
      setIsDragging(true)
      railRef.current?.setPointerCapture(event.pointerId)
      setIndicator(letter)
      onSelectLetter(letter)
    },
    [letterFromClientY, onSelectLetter, setIndicator],
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!isDraggingRef.current) return
      const letter = letterFromClientY(event.clientY)
      if (!letter || letter === indicatorRef.current) return
      setIndicator(letter)
      onSelectLetter(letter)
    },
    [letterFromClientY, onSelectLetter, setIndicator],
  )

  const endDrag = useCallback(
    (event: React.PointerEvent) => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      setIsDragging(false)
      setIndicator(null)
      try {
        railRef.current?.releasePointerCapture(event.pointerId)
      } catch {
        // Pointer may already be released — safe to ignore.
      }
    },
    [setIndicator],
  )

  return {
    railRef,
    indicatorLetter,
    isDragging,
    railHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  }
}
