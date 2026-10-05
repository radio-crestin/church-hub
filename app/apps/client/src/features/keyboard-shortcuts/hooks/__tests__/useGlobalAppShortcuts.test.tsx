import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The hook reads this once, when its module is imported, to decide whether
// global shortcuts exist at all — so it has to be in place before that import.
vi.hoisted(() => {
  ;(globalThis as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
})

import { DEFAULT_SHORTCUTS_CONFIG } from '../../types'
import { useGlobalAppShortcuts } from '../useGlobalAppShortcuts'
import { useIsAppFrontmost } from '../useIsAppFrontmost'

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: vi.fn().mockResolvedValue(undefined),
  unregisterAll: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../useIsAppFrontmost', () => ({
  useIsAppFrontmost: vi.fn(),
}))

const { register, unregisterAll } = await import(
  '@tauri-apps/plugin-global-shortcut'
)
const registerMock = vi.mocked(register)
const unregisterAllMock = vi.mocked(unregisterAll)
const frontmost = vi.mocked(useIsAppFrontmost)

const noop = () => {}

function renderShortcuts(
  onNextSlide: (shortcut: string) => void = noop,
  onlyWhenAppFocused = false,
) {
  return renderHook(() =>
    useGlobalAppShortcuts({
      shortcuts: {
        ...DEFAULT_SHORTCUTS_CONFIG,
        onlyWhenAppFocused,
        actions: {
          ...DEFAULT_SHORTCUTS_CONFIG.actions,
          nextSlide: { enabled: true, shortcuts: ['F2'] },
        },
      },
      sceneShortcuts: [{ shortcut: 'F10', sceneName: 'Main' }],
      sidebarShortcuts: [
        {
          shortcut: 'F6',
          itemId: 'bible',
          route: '/bible',
          focusSearchOnNavigate: true,
          displayName: 'Bible',
        },
      ],
      pageShortcuts: ['F9'],
      onStartLive: noop,
      onStopLive: noop,
      onShowSlide: noop,
      onNextSlide,
      onPrevSlide: noop,
      onSceneSwitch: noop,
      onSidebarNavigation: noop,
      onPageShortcut: noop,
    }),
  )
}

function registeredKeys(): string[] {
  return registerMock.mock.calls.map(([shortcut]) => shortcut as string)
}

describe('useGlobalAppShortcuts', () => {
  beforeEach(() => {
    registerMock.mockClear()
    unregisterAllMock.mockClear()
  })

  it('holds navigation keys OS-wide while Church Hub is in front', async () => {
    frontmost.mockReturnValue(true)
    renderShortcuts()

    await waitFor(() => expect(registeredKeys()).toContain('F6'))
    expect(registeredKeys()).toContain('F9')
    expect(registeredKeys()).toContain('F2')
  })

  it('hands navigation keys back to the other app once Church Hub is behind it', async () => {
    frontmost.mockReturnValue(false)
    renderShortcuts()

    // Presentation control stays global — running the service from another
    // window is what it is for — but nothing that only navigates inside
    // Church Hub may swallow a key the user meant for the app they are in.
    await waitFor(() => expect(registeredKeys()).toContain('F2'))
    expect(registeredKeys()).not.toContain('F6')
    expect(registeredKeys()).not.toContain('F9')
  })

  it('keeps presentation and scene keys while Church Hub is behind, by default', async () => {
    frontmost.mockReturnValue(false)
    renderShortcuts()

    await waitFor(() => expect(registeredKeys()).toContain('F2'))
    expect(registeredKeys()).toContain('F10')
  })

  it('lets every key go to the app in front when set to "only when in front"', async () => {
    frontmost.mockReturnValue(false)
    renderShortcuts(noop, true)

    // F1–F12 must reach the program in front (e.g. BibleShow) instead of a
    // minimised Church Hub.
    await waitFor(() => expect(unregisterAllMock).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(registeredKeys()).toEqual([])
  })

  it('holds every key again once Church Hub is back in front, in that mode', async () => {
    frontmost.mockReturnValue(true)
    renderShortcuts(noop, true)

    await waitFor(() => expect(registeredKeys()).toContain('F2'))
    expect(registeredKeys()).toContain('F10')
    expect(registeredKeys()).toContain('F6')
  })

  it('tells the Next handler which key was pressed', async () => {
    frontmost.mockReturnValue(true)
    const onNextSlide = vi.fn()
    renderShortcuts(onNextSlide)

    await waitFor(() => expect(registeredKeys()).toContain('F2'))
    const call = registerMock.mock.calls.find(([key]) => key === 'F2')
    const onPressed = call?.[1] as (event: { state: string }) => void
    onPressed({ state: 'Pressed' })

    // The key travels on, so a page can tell this press apart from the same
    // key reaching it directly (see isEchoedNavigationKey).
    expect(onNextSlide).toHaveBeenCalledWith('F2')
  })
})
