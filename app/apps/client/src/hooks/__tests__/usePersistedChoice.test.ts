import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { usePersistedChoice } from '../usePersistedChoice'

const CHOICES = ['all', 'sung', 'pending'] as const
const KEY = 'test.sungFilter'

describe('usePersistedChoice', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts on the fallback when nothing was stored', () => {
    const { result } = renderHook(() => usePersistedChoice(KEY, CHOICES, 'all'))
    expect(result.current[0]).toBe('all')
  })

  it('reads back what was stored, so a restart lands where the user left', () => {
    localStorage.setItem(KEY, 'pending')
    const { result } = renderHook(() => usePersistedChoice(KEY, CHOICES, 'all'))
    expect(result.current[0]).toBe('pending')
  })

  it('stores each new choice', () => {
    const { result } = renderHook(() => usePersistedChoice(KEY, CHOICES, 'all'))
    act(() => result.current[1]('sung'))
    expect(result.current[0]).toBe('sung')
    expect(localStorage.getItem(KEY)).toBe('sung')
  })

  it('falls back rather than trusting a value that is no longer a choice', () => {
    localStorage.setItem(KEY, 'whatever-this-used-to-mean')
    const { result } = renderHook(() => usePersistedChoice(KEY, CHOICES, 'all'))
    expect(result.current[0]).toBe('all')
  })
})
