import { describe, expect, it, vi } from 'vitest'

import {
  emitNavigationShortcut,
  listenForNavigationShortcuts,
} from '../navigationShortcutEvent'

describe('navigation shortcut event', () => {
  it('reaches the listener with the direction and the key', () => {
    const onShortcut = vi.fn().mockReturnValue(true)
    const stop = listenForNavigationShortcuts(onShortcut)

    emitNavigationShortcut('next', 'F2')

    expect(onShortcut).toHaveBeenCalledWith({
      direction: 'next',
      shortcut: 'F2',
    })
    stop()
  })

  it('tells the emitter whether the listener took it', () => {
    const stop = listenForNavigationShortcuts(
      ({ direction }) => direction === 'next',
    )

    expect(emitNavigationShortcut('next', 'F2')).toBe(true)
    expect(emitNavigationShortcut('prev', 'F1')).toBe(false)
    stop()
  })

  it('is not taken once nothing listens', () => {
    const onShortcut = vi.fn().mockReturnValue(true)
    const stop = listenForNavigationShortcuts(onShortcut)
    stop()

    expect(emitNavigationShortcut('next', 'F2')).toBe(false)
    expect(onShortcut).not.toHaveBeenCalled()
  })
})
