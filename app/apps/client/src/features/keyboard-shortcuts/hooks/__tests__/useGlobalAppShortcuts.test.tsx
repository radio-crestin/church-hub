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

const { register } = await import('@tauri-apps/plugin-global-shortcut')
const registerMock = vi.mocked(register)
const frontmost = vi.mocked(useIsAppFrontmost)

const noop = () => {}

function renderShortcuts() {
  return renderHook(() =>
    useGlobalAppShortcuts({
      shortcuts: {
        ...DEFAULT_SHORTCUTS_CONFIG,
        actions: {
          ...DEFAULT_SHORTCUTS_CONFIG.actions,
          nextSlide: { enabled: true, shortcuts: ['F2'] },
        },
      },
      sceneShortcuts: [],
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
      onNextSlide: noop,
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
})
