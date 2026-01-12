import { useCallback, useRef } from 'react'

import type { SongMetadata } from '../components/SongDetailsSection'
import type { LocalSlide } from '../components/SongSlideList'

interface SongState {
  title: string
  categoryId: number | null
  slides: LocalSlide[]
  metadata?: SongMetadata
}

function areMetadataEqual(
  a: SongMetadata | undefined,
  b: SongMetadata | undefined,
): boolean {
  if (!a && !b) return true
  if (!a || !b) return false

  return (
    a.author === b.author &&
    a.copyright === b.copyright &&
    a.ccli === b.ccli &&
    a.tempo === b.tempo &&
    a.timeSignature === b.timeSignature &&
    a.theme === b.theme &&
    a.altTheme === b.altTheme &&
    a.hymnNumber === b.hymnNumber &&
    a.keyLine === b.keyLine &&
    a.presentationOrder === b.presentationOrder &&
    a.sourceFilename === b.sourceFilename
  )
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

  if (!areMetadataEqual(a.metadata, b.metadata)) return false

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
      metadata: state.metadata ? { ...state.metadata } : undefined,
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
      metadata: currentState.metadata
        ? { ...currentState.metadata }
        : undefined,
    }

    return !areStatesEqual(normalizedCurrent, savedStateRef.current)
  }, [])

  const resetSavedState = useCallback(() => {
    savedStateRef.current = null
  }, [])

  return { setSavedState, isDirty, resetSavedState }
}
