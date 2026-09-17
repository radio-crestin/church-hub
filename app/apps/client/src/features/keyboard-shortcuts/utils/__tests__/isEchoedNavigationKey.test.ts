import { describe, expect, it } from 'vitest'

import {
  type HandledNavigationKey,
  isEchoedNavigationKey,
  NAVIGATION_ECHO_WINDOW_MS,
} from '../isEchoedNavigationKey'

const pageKey: HandledNavigationKey = {
  shortcut: 'PageDown',
  source: 'keyboard',
  at: 1000,
}

describe('isEchoedNavigationKey', () => {
  it('knows the same key arriving right after by the other route', () => {
    expect(
      isEchoedNavigationKey(pageKey, {
        shortcut: 'PageDown',
        source: 'shortcut',
        at: 1010,
      }),
    ).toBe(true)
    expect(
      isEchoedNavigationKey(
        { ...pageKey, source: 'shortcut' },
        { shortcut: 'PageDown', source: 'keyboard', at: 1010 },
      ),
    ).toBe(true)
  })

  it('takes a second press by the same route as a real press', () => {
    expect(
      isEchoedNavigationKey(pageKey, {
        shortcut: 'PageDown',
        source: 'keyboard',
        at: 1010,
      }),
    ).toBe(false)
  })

  it('takes a different key as a real press', () => {
    expect(
      isEchoedNavigationKey(pageKey, {
        shortcut: 'F2',
        source: 'shortcut',
        at: 1010,
      }),
    ).toBe(false)
  })

  it('takes the same key after the window as a real press', () => {
    expect(
      isEchoedNavigationKey(pageKey, {
        shortcut: 'PageDown',
        source: 'shortcut',
        at: pageKey.at + NAVIGATION_ECHO_WINDOW_MS,
      }),
    ).toBe(false)
  })

  it('has nothing to echo before any key was handled', () => {
    expect(
      isEchoedNavigationKey(null, {
        shortcut: 'PageDown',
        source: 'shortcut',
        at: 1010,
      }),
    ).toBe(false)
  })
})
