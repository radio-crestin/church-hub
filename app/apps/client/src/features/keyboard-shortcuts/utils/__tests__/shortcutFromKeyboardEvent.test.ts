import { describe, expect, it } from 'vitest'

import { shortcutFromKeyboardEvent } from '../shortcutFromKeyboardEvent'

const noModifiers = {
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
}

describe('shortcutFromKeyboardEvent', () => {
  it('writes a bare named key as it is', () => {
    expect(shortcutFromKeyboardEvent({ ...noModifiers, key: 'PageDown' })).toBe(
      'PageDown',
    )
  })

  it('upper-cases a single character', () => {
    expect(shortcutFromKeyboardEvent({ ...noModifiers, key: 'k' })).toBe('K')
  })

  it('puts the modifiers first, in a fixed order', () => {
    expect(
      shortcutFromKeyboardEvent({
        key: 'k',
        metaKey: false,
        ctrlKey: true,
        altKey: true,
        shiftKey: true,
      }),
    ).toBe('CommandOrControl+Alt+Shift+K')
  })

  it('treats Cmd and Ctrl as the same modifier', () => {
    expect(
      shortcutFromKeyboardEvent({ ...noModifiers, key: 'F2', metaKey: true }),
    ).toBe('CommandOrControl+F2')
  })

  it('is empty while only a modifier is down', () => {
    expect(
      shortcutFromKeyboardEvent({
        ...noModifiers,
        key: 'Shift',
        shiftKey: true,
      }),
    ).toBe('')
  })
})
