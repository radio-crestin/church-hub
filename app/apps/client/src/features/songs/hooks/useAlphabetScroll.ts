import { useCallback, useEffect, useRef, useState } from 'react'

import { ALPHABET_INDEX_LETTERS } from '../constants/alphabet'
import type { AlphabetSection } from '../utils/buildAlphabetSections'
import { findNearestLetter } from '../utils/findNearestLetter'

// How far below the scroll top a section header must be before it counts as the
// "active" section — roughly the sticky header height, so the active letter
// flips exactly when the next header docks at the top.
const ACTIVE_SECTION_OFFSET = 40

interface UseAlphabetScrollOptions {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  sections: AlphabetSection[]
  availableLetters: Set<string>
}

interface UseAlphabetScrollReturn {
  /** Full rail order (A…Z, "#"). */
  letters: string[]
  /** Letter currently in view at the top of the list. */
  activeLetter: string | null
  /** Letter under the finger while dragging (drives the floating bubble). */
  indicatorLetter: string | null
  isDragging: boolean
  /** Attach to the rail element — used to map pointer Y → letter. */
  railRef: React.RefObject<HTMLDivElement | null>
  /** Register each section header so we can scroll to / observe it. */
  registerSectionRef: (letter: string, element: HTMLElement | null) => void
  /** Smoothly jump to a letter (click / keyboard activation). */
  jumpToLetter: (letter: string) => void
  /** Pointer gesture handlers for the rail container. */
  railHandlers: {
    onPointerDown: (event: React.PointerEvent) => void
    onPointerMove: (event: React.PointerEvent) => void
    onPointerUp: (event: React.PointerEvent) => void
    onPointerCancel: (event: React.PointerEvent) => void
  }
}

/**
 * Drives the alphabet fast-scroll interaction: pointer/touch dragging on the
 * rail, jump-to-nearest-letter, the floating letter bubble, and keeping the
 * active letter in sync as the list is scrolled manually.
 */
export function useAlphabetScroll({
  scrollContainerRef,
  sections,
  availableLetters,
}: UseAlphabetScrollOptions): UseAlphabetScrollReturn {
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map())
  const railRef = useRef<HTMLDivElement | null>(null)
  const isDraggingRef = useRef(false)
  const indicatorRef = useRef<string | null>(null)
  const rafRef = useRef<number | null>(null)

  const [activeLetter, setActiveLetter] = useState<string | null>(null)
  const [indicatorLetter, setIndicatorLetter] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const registerSectionRef = useCallback(
    (letter: string, element: HTMLElement | null) => {
      if (element) sectionRefs.current.set(letter, element)
      else sectionRefs.current.delete(letter)
    },
    [],
  )

  const setIndicator = useCallback((letter: string | null) => {
    indicatorRef.current = letter
    setIndicatorLetter(letter)
  }, [])

  const scrollToLetter = useCallback(
    (letter: string, smooth: boolean) => {
      const resolved = findNearestLetter(letter, availableLetters)
      const container = scrollContainerRef.current
      if (!resolved || !container) return
      const target = sectionRefs.current.get(resolved)
      if (!target) return

      container.scrollTo({
        top: target.offsetTop,
        behavior: smooth ? 'smooth' : 'auto',
      })
      setActiveLetter(resolved)
    },
    [availableLetters, scrollContainerRef],
  )

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

  const jumpToLetter = useCallback(
    (letter: string) => scrollToLetter(letter, true),
    [scrollToLetter],
  )

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault()
      const letter = letterFromClientY(event.clientY)
      if (!letter) return
      isDraggingRef.current = true
      setIsDragging(true)
      railRef.current?.setPointerCapture(event.pointerId)
      setIndicator(letter)
      scrollToLetter(letter, false)
    },
    [letterFromClientY, scrollToLetter, setIndicator],
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!isDraggingRef.current) return
      const letter = letterFromClientY(event.clientY)
      if (!letter || letter === indicatorRef.current) return
      setIndicator(letter)
      scrollToLetter(letter, false)
    },
    [letterFromClientY, scrollToLetter, setIndicator],
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

  // Keep the active letter in sync while the list is scrolled by other means
  // (wheel, keyboard nav, drag inertia). rAF-throttled so very large lists stay
  // smooth.
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const updateActiveLetter = () => {
      rafRef.current = null
      if (isDraggingRef.current) return
      const threshold = container.scrollTop + ACTIVE_SECTION_OFFSET
      let current: string | null = sections[0]?.letter ?? null
      for (const section of sections) {
        const element = sectionRefs.current.get(section.letter)
        if (element && element.offsetTop <= threshold) current = section.letter
        else break
      }
      setActiveLetter(current)
    }

    const onScroll = () => {
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(updateActiveLetter)
    }

    updateActiveLetter()
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', onScroll)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [scrollContainerRef, sections])

  return {
    letters: ALPHABET_INDEX_LETTERS,
    activeLetter,
    indicatorLetter,
    isDragging,
    railRef,
    registerSectionRef,
    jumpToLetter,
    railHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  }
}
