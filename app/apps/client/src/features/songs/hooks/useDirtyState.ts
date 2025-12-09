import { useCallback, useRef } from 'react'

import type { LocalSlide } from '../components/SongSlideList'

interface SongState {
  title: string
  categoryId: number | null
  slides: LocalSlide[]
}

function areStatesEqual(a: SongState, b: SongState): boolean {
  if (a.title !== b.title) return false
  if (a.categoryId !== b.categoryId) return false
  if (a.slides.length !== b.slides.length) return false

  for (let i = 0; i < a.slides.length; i++) {
    if (a.slides[i].content !== b.slides[i].content) return false
    // Compare by index position (sortOrder after save reflects position)
    if (a.slides[i].sortOrder !== b.slides[i].sortOrder) return false
  }

  return true
}

export function useDirtyState() {
  const savedStateRef = useRef<SongState | null>(null)

  const setSavedState = useCallback((state: SongState) => {
    savedStateRef.current = {
      title: state.title,
      categoryId: state.categoryId,
      slides: state.slides.map((s, idx) => ({
        id: s.id,
        content: s.content,
        sortOrder: idx,
      })),
    }
  }, [])

  const isDirty = useCallback((currentState: SongState): boolean => {
    // New song without saved state is always dirty (needs to be saved)
    if (!savedStateRef.current) return true

    const normalizedCurrent: SongState = {
      title: currentState.title,
      categoryId: currentState.categoryId,
      slides: currentState.slides.map((s, idx) => ({
        id: s.id,
        content: s.content,
        sortOrder: idx,
      })),
    }

    return !areStatesEqual(normalizedCurrent, savedStateRef.current)
  }, [])

  const resetSavedState = useCallback(() => {
    savedStateRef.current = null
  }, [])

  return { setSavedState, isDirty, resetSavedState }
}
