import { useCallback, useRef } from 'react'

import {
  KEYBOARD_PRIORITY,
  useKeyboardNavigationHandler,
} from '~/features/keyboard-shortcuts'
import type { DeckElement, DeckSlide } from '../../types'
import type { DeckAction } from '../types'
import { withFreshIds } from '../utils/withFreshIds'

/** A pasted or duplicated element lands this far from the original. */
const PASTE_OFFSET = 20

const NUDGE: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

interface UseDeckEditorKeysInput {
  slide: DeckSlide | undefined
  selected: DeckElement | undefined
  select: (elementId: string | null) => void
  change: (action: DeckAction, merge?: string) => void
  undo: () => void
  redo: () => void
}

/**
 * The editor's keys, ahead of the presentation's own (an arrow nudges the
 * element, it doesn't move the presentation on): arrows nudge (Shift: 10px),
 * Delete removes, Ctrl+C/V/D copy, paste and duplicate, Ctrl+Z undoes and
 * Ctrl+Shift+Z or Ctrl+Y redoes. Typing in a field or a text box keeps its
 * keys (the keyboard context skips those).
 */
export function useDeckEditorKeys({
  slide,
  selected,
  select,
  change,
  undo,
  redo,
}: UseDeckEditorKeysInput) {
  const clipboardRef = useRef<DeckElement | null>(null)

  const paste = useCallback(
    (element: DeckElement) => {
      if (!slide) return
      const [copy] = withFreshIds([
        {
          ...element,
          x: element.x + PASTE_OFFSET,
          y: element.y + PASTE_OFFSET,
          locked: undefined,
        },
      ])
      if (!copy) return
      change({ type: 'element/insert', slideId: slide.id, elements: [copy] })
      select(copy.id)
    },
    [change, select, slide],
  )

  const handler = useCallback(
    (event: KeyboardEvent): boolean => {
      const command = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      if (command && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return true
      }
      if (command && key === 'y') {
        event.preventDefault()
        redo()
        return true
      }
      if (command && key === 'v' && clipboardRef.current) {
        event.preventDefault()
        paste(clipboardRef.current)
        return true
      }
      if (!slide || !selected) return false
      if (command && key === 'c') {
        clipboardRef.current = selected
        return true
      }
      if (command && key === 'd') {
        event.preventDefault()
        paste(selected)
        return true
      }
      if (selected.locked) return false
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        change({
          type: 'element/remove',
          slideId: slide.id,
          elementId: selected.id,
        })
        select(null)
        return true
      }
      const nudge = NUDGE[event.key]
      if (nudge) {
        event.preventDefault()
        const step = event.shiftKey ? 10 : 1
        change(
          {
            type: 'element/update',
            slideId: slide.id,
            elementId: selected.id,
            patch: {
              x: selected.x + nudge[0] * step,
              y: selected.y + nudge[1] * step,
            },
          },
          `nudge:${selected.id}`,
        )
        return true
      }
      return false
    },
    [change, paste, redo, select, selected, slide, undo],
  )

  useKeyboardNavigationHandler(
    'slides-deck-editor',
    KEYBOARD_PRIORITY.PAGE,
    handler,
  )
}
