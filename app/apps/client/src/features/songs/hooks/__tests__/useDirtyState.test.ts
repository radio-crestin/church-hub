import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useDirtyState } from '../useDirtyState'

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Test Song',
    categoryId: 1,
    tagIds: [] as number[],
    slides: [
      { id: 1, content: 'Verse 1', sortOrder: 0, label: 'V1', chords: null },
      { id: 2, content: 'Chorus', sortOrder: 1, label: 'C1', chords: null },
    ],
    metadata: {
      author: null,
      copyright: null,
      ccli: null,
      tempo: null,
      timeSignature: null,
      theme: null,
      altTheme: null,
      hymnNumber: null,
      keyLine: null,
      presentationOrder: null,
      sourceFilename: null,
    },
    ...overrides,
  }
}

describe('useDirtyState', () => {
  it('isDirty returns true when no saved state is set (new song)', () => {
    const { result } = renderHook(() => useDirtyState())
    expect(result.current.isDirty(makeState())).toBe(true)
  })

  it('isDirty returns false when current matches saved state', () => {
    const { result } = renderHook(() => useDirtyState())
    const state = makeState()
    result.current.setSavedState(state)
    expect(result.current.isDirty(state)).toBe(false)
  })

  it('isDirty detects title change', () => {
    const { result } = renderHook(() => useDirtyState())
    const state = makeState()
    result.current.setSavedState(state)
    expect(result.current.isDirty(makeState({ title: 'Changed' }))).toBe(true)
  })

  it('isDirty detects category change', () => {
    const { result } = renderHook(() => useDirtyState())
    const state = makeState()
    result.current.setSavedState(state)
    expect(result.current.isDirty(makeState({ categoryId: 2 }))).toBe(true)
  })

  it('isDirty detects tagIds change', () => {
    const { result } = renderHook(() => useDirtyState())
    const state = makeState({ tagIds: [1, 2] })
    result.current.setSavedState(state)
    expect(result.current.isDirty(makeState({ tagIds: [1, 2, 3] }))).toBe(true)
  })

  it('isDirty ignores tagIds order (set semantics)', () => {
    const { result } = renderHook(() => useDirtyState())
    const state = makeState({ tagIds: [1, 2, 3] })
    result.current.setSavedState(state)
    expect(result.current.isDirty(makeState({ tagIds: [3, 1, 2] }))).toBe(false)
  })

  it('isDirty detects slide content change', () => {
    const { result } = renderHook(() => useDirtyState())
    const state = makeState()
    result.current.setSavedState(state)
    const modified = makeState({
      slides: [
        {
          id: 1,
          content: 'Modified verse',
          sortOrder: 0,
          label: 'V1',
          chords: null,
        },
        { id: 2, content: 'Chorus', sortOrder: 1, label: 'C1', chords: null },
      ],
    })
    expect(result.current.isDirty(modified)).toBe(true)
  })

  it('isDirty detects slide count change', () => {
    const { result } = renderHook(() => useDirtyState())
    const state = makeState()
    result.current.setSavedState(state)
    const modified = makeState({
      slides: [
        { id: 1, content: 'Verse 1', sortOrder: 0, label: 'V1', chords: null },
      ],
    })
    expect(result.current.isDirty(modified)).toBe(true)
  })

  it('isDirty detects slide label change', () => {
    const { result } = renderHook(() => useDirtyState())
    const state = makeState()
    result.current.setSavedState(state)
    const modified = makeState({
      slides: [
        { id: 1, content: 'Verse 1', sortOrder: 0, label: 'V2', chords: null },
        { id: 2, content: 'Chorus', sortOrder: 1, label: 'C1', chords: null },
      ],
    })
    expect(result.current.isDirty(modified)).toBe(true)
  })

  it('isDirty detects chord changes', () => {
    const { result } = renderHook(() => useDirtyState())
    const state = makeState()
    result.current.setSavedState(state)
    const modified = makeState({
      slides: [
        {
          id: 1,
          content: 'Verse 1',
          sortOrder: 0,
          label: 'V1',
          chords: [{ wordIndex: 0, chord: 'G' }],
        },
        { id: 2, content: 'Chorus', sortOrder: 1, label: 'C1', chords: null },
      ],
    })
    expect(result.current.isDirty(modified)).toBe(true)
  })

  it('isDirty detects metadata change', () => {
    const { result } = renderHook(() => useDirtyState())
    const state = makeState()
    result.current.setSavedState(state)
    const modified = makeState({
      metadata: {
        ...state.metadata,
        author: 'John Newton',
      },
    })
    expect(result.current.isDirty(modified)).toBe(true)
  })

  it('isDirty treats undefined and null label as equal', () => {
    const { result } = renderHook(() => useDirtyState())
    const state = makeState({
      slides: [
        {
          id: 1,
          content: 'Text',
          sortOrder: 0,
          label: undefined,
          chords: null,
        },
      ],
    })
    result.current.setSavedState(state)
    const current = makeState({
      slides: [
        { id: 1, content: 'Text', sortOrder: 0, label: null, chords: null },
      ],
    })
    expect(result.current.isDirty(current)).toBe(false)
  })

  it('isDirty normalizes sortOrder by index position', () => {
    const { result } = renderHook(() => useDirtyState())
    // Save with sortOrder values that match index positions
    const state = makeState({
      slides: [
        { id: 1, content: 'A', sortOrder: 5, label: null, chords: null },
        { id: 2, content: 'B', sortOrder: 10, label: null, chords: null },
      ],
    })
    result.current.setSavedState(state)
    // Current state has same slides in same order but different sortOrder values
    const current = makeState({
      slides: [
        { id: 1, content: 'A', sortOrder: 0, label: null, chords: null },
        { id: 2, content: 'B', sortOrder: 1, label: null, chords: null },
      ],
    })
    // Both get normalized to index-based sortOrder (0, 1), so they match
    expect(result.current.isDirty(current)).toBe(false)
  })

  it('resetSavedState makes isDirty return true', () => {
    const { result } = renderHook(() => useDirtyState())
    const state = makeState()
    result.current.setSavedState(state)
    expect(result.current.isDirty(state)).toBe(false)
    result.current.resetSavedState()
    expect(result.current.isDirty(state)).toBe(true)
  })

  it('handles state with no metadata', () => {
    const { result } = renderHook(() => useDirtyState())
    const state = makeState({ metadata: undefined })
    result.current.setSavedState(state)
    expect(result.current.isDirty(state)).toBe(false)
  })

  it('detects when metadata appears from undefined', () => {
    const { result } = renderHook(() => useDirtyState())
    const state = makeState({ metadata: undefined })
    result.current.setSavedState(state)
    const modified = makeState({
      metadata: {
        author: 'New Author',
        copyright: null,
        ccli: null,
        tempo: null,
        timeSignature: null,
        theme: null,
        altTheme: null,
        hymnNumber: null,
        keyLine: null,
        presentationOrder: null,
        sourceFilename: null,
      },
    })
    expect(result.current.isDirty(modified)).toBe(true)
  })

  it('handles empty slides array', () => {
    const { result } = renderHook(() => useDirtyState())
    const state = makeState({ slides: [] })
    result.current.setSavedState(state)
    expect(result.current.isDirty(makeState({ slides: [] }))).toBe(false)
  })
})
