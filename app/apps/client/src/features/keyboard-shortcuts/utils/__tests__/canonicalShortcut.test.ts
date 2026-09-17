import { describe, expect, it } from 'vitest'

import { canonicalShortcut } from '../canonicalShortcut'
import { shortcutFromKeyboardEvent } from '../shortcutFromKeyboardEvent'

/** A key press as the page writes it. */
function pressed(
  key: string,
  modifiers: Partial<
    Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>
  > = {},
): string {
  return shortcutFromKeyboardEvent({
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers,
  })
}

describe('canonicalShortcut', () => {
  it('spells the arrows the same whichever name the shell was given', () => {
    const down = canonicalShortcut(pressed('ArrowDown'))
    expect(canonicalShortcut('Down')).toBe(down)
    expect(canonicalShortcut('ArrowDown')).toBe(down)
    expect(canonicalShortcut('arrowdown')).toBe(down)
    expect(canonicalShortcut('Right')).toBe(
      canonicalShortcut(pressed('ArrowRight')),
    )
  })

  it('keeps page keys and function keys as they are', () => {
    expect(canonicalShortcut('PageDown')).toBe(
      canonicalShortcut(pressed('PageDown')),
    )
    expect(canonicalShortcut('F2')).toBe(canonicalShortcut(pressed('F2')))
    expect(canonicalShortcut('PageDown')).not.toBe(canonicalShortcut('PageUp'))
  })

  it('folds every name for Command and Control into one', () => {
    const withMeta = canonicalShortcut(pressed('ArrowRight', { metaKey: true }))
    const withCtrl = canonicalShortcut(pressed('ArrowRight', { ctrlKey: true }))
    expect(withMeta).toBe(withCtrl)
    for (const stored of [
      'CommandOrControl+Right',
      'CmdOrCtrl+ArrowRight',
      'Cmd+Right',
      'Control+Right',
      'Super+Right',
    ]) {
      expect(canonicalShortcut(stored)).toBe(withMeta)
    }
  })

  it('ignores the order modifiers were written in', () => {
    expect(canonicalShortcut('Shift+Option+Cmd+K')).toBe(
      canonicalShortcut(
        pressed('k', { metaKey: true, altKey: true, shiftKey: true }),
      ),
    )
  })

  it("reads the parser's physical key names as the key", () => {
    expect(canonicalShortcut('KeyB')).toBe(canonicalShortcut(pressed('b')))
    expect(canonicalShortcut('Digit1')).toBe(canonicalShortcut(pressed('1')))
    expect(canonicalShortcut('Space')).toBe(canonicalShortcut(pressed(' ')))
    expect(canonicalShortcut('Esc')).toBe(canonicalShortcut(pressed('Escape')))
  })

  it('tells a modified key from the bare key', () => {
    expect(canonicalShortcut('Shift+ArrowDown')).not.toBe(
      canonicalShortcut('ArrowDown'),
    )
  })
})
