import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  emitPageShortcutEvent,
  usePageShortcutEvent,
} from '../pageShortcutEvent'

describe('page shortcut event', () => {
  it('reaches only the page and action it was raised for', () => {
    const songs = vi.fn()
    const bible = vi.fn()
    const songsNext = vi.fn()
    renderHook(() => usePageShortcutEvent('songs', 'showSlide', songs))
    renderHook(() => usePageShortcutEvent('bible', 'showSlide', bible))
    renderHook(() => usePageShortcutEvent('songs', 'nextSlide', songsNext))

    emitPageShortcutEvent('songs', 'showSlide')

    expect(songs).toHaveBeenCalledTimes(1)
    expect(bible).not.toHaveBeenCalled()
    expect(songsNext).not.toHaveBeenCalled()
  })

  it('is ignored by a page that is not listening', () => {
    const songs = vi.fn()
    renderHook(() => usePageShortcutEvent('songs', 'showSlide', songs, false))

    emitPageShortcutEvent('songs', 'showSlide')

    expect(songs).not.toHaveBeenCalled()
  })

  it('stops listening once unmounted', () => {
    const songs = vi.fn()
    const { unmount } = renderHook(() =>
      usePageShortcutEvent('songs', 'showSlide', songs),
    )
    unmount()

    emitPageShortcutEvent('songs', 'showSlide')

    expect(songs).not.toHaveBeenCalled()
  })
})
