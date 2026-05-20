import { useCallback, useRef } from 'react'

import type { SongMetadata } from '../components/SongDetailsSection'
import type { LocalSlide } from '../components/SongSlideList'

interface SongState {
  title: string
  categoryId: number | null
  tagIds: number[]
  slides: LocalSlide[]
  metadata?: SongMetadata
}

function areTagIdsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  // Order-insensitive comparison — assignments are a set, not a list.
  const sortedA = [...a].sort((x, y) => x - y)
  const sortedB = [...b].sort((x, y) => x - y)
  for (let i = 0; i < sortedA.length; i++) {
    if (sortedA[i] !== sortedB[i]) return false
  }
  return true
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
  if (!areTagIdsEqual(a.tagIds, b.tagIds)) return false
  if (a.slides.length !== b.slides.length) return false

  for (let i = 0; i < a.slides.length; i++) {
    if (a.slides[i].content !== b.slides[i].content) return false
    // Compare by index position (sortOrder after save reflects position)
    if (a.slides[i].sortOrder !== b.slides[i].sortOrder) return false
    if ((a.slides[i].label ?? null) !== (b.slides[i].label ?? null))
      return false
    // Compare chords by JSON serialization
    const chordsA = JSON.stringify(a.slides[i].chords ?? null)
    const chordsB = JSON.stringify(b.slides[i].chords ?? null)
    if (chordsA !== chordsB) return false
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
      tagIds: [...state.tagIds],
      slides: state.slides.map((s, idx) => ({
        id: s.id,
        content: s.content,
        chords: s.chords ? [...s.chords] : null,
        sortOrder: idx,
        label: s.label ?? null,
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
      tagIds: currentState.tagIds,
      slides: currentState.slides.map((s, idx) => ({
        id: s.id,
        content: s.content,
        chords: s.chords ? [...s.chords] : null,
        sortOrder: idx,
        label: s.label ?? null,
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
