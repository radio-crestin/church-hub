import { useCallback, useReducer } from 'react'

import { deckReducer } from './deckReducer'
import type { SlideDeck } from '../../types'
import type { DeckAction } from '../types'

/** Undo goes back this many changes at most. */
const LIMIT = 100

interface History {
  past: SlideDeck[]
  present: SlideDeck
  future: SlideDeck[]
  /** What the last change was, so a run of the same one undoes at once. */
  lastMerge: string | null
}

type HistoryAction =
  | { type: 'change'; action: DeckAction; merge?: string }
  | { type: 'undo' }
  | { type: 'redo' }

function historyReducer(history: History, action: HistoryAction): History {
  switch (action.type) {
    case 'change': {
      const present = deckReducer(history.present, action.action)
      if (present === history.present) return history
      const merges = !!action.merge && action.merge === history.lastMerge
      return {
        past: merges
          ? history.past
          : [...history.past, history.present].slice(-LIMIT),
        present,
        future: [],
        lastMerge: action.merge ?? null,
      }
    }
    case 'undo': {
      const previous = history.past.at(-1)
      if (!previous) return history
      return {
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future],
        lastMerge: null,
      }
    }
    case 'redo': {
      const [next, ...future] = history.future
      if (!next) return history
      return {
        past: [...history.past, history.present],
        present: next,
        future,
        lastMerge: null,
      }
    }
  }
}

/**
 * The deck being edited, with undo and redo over every change. Changes
 * given the same `merge` key one after another (typing in a box, nudging it
 * with the arrows) undo as one.
 */
export function useDeckHistory(initial: SlideDeck) {
  const [history, send] = useReducer(historyReducer, {
    past: [],
    present: initial,
    future: [],
    lastMerge: null,
  })
  const change = useCallback(
    (action: DeckAction, merge?: string) =>
      send({ type: 'change', action, merge }),
    [],
  )
  const undo = useCallback(() => send({ type: 'undo' }), [])
  const redo = useCallback(() => send({ type: 'redo' }), [])
  return {
    deck: history.present,
    change,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }
}
