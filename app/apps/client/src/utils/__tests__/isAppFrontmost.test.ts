import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isAppFrontmost } from '../isAppFrontmost'

const { getAllWebviewWindows } = vi.hoisted(() => ({
  getAllWebviewWindows: vi.fn(),
}))
vi.mock('@tauri-apps/api/webviewWindow', () => ({ getAllWebviewWindows }))

/** Windows whose `isFocused()` answers as given, in order. */
function windowsFocused(...states: boolean[]) {
  return states.map((focused) => ({
    isFocused: vi.fn().mockResolvedValue(focused),
  }))
}

describe('isAppFrontmost', () => {
  beforeEach(() => {
    getAllWebviewWindows.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('counts this page holding the keyboard even when no window reports focus', async () => {
    // What Linux always reports, and Windows while WebView2 has the keyboard.
    getAllWebviewWindows.mockResolvedValue(windowsFocused(false, false))
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)

    expect(await isAppFrontmost()).toBe(true)
  })

  it('falls back to the windows when this page does not have the keyboard', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)

    getAllWebviewWindows.mockResolvedValue(windowsFocused(false, true))
    expect(await isAppFrontmost()).toBe(true)

    getAllWebviewWindows.mockResolvedValue(windowsFocused(false, false))
    expect(await isAppFrontmost()).toBe(false)
  })

  it('answers no when the windows cannot be asked and the page is not focused', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    getAllWebviewWindows.mockRejectedValue(new Error('no IPC'))

    expect(await isAppFrontmost()).toBe(false)
  })
})
