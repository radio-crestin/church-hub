import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * T-123. Sidebar page keys (F4 Present, F5 Songs, F6 Bible, …) work only while
 * Church Hub has the keyboard, unless Settings → Shortcuts says "from any
 * program". App-level keys are never held by the desktop shell OS-wide: the
 * page handles the press itself, so another program in front keeps its keys.
 *
 * Keys that are held OS-wide only while Church Hub is in front (page keys, and
 * presentation keys with "only when Church Hub is in front") are let go as
 * soon as no Church Hub window has the keyboard, whichever window lost it.
 *
 * A browser cannot press OS-wide keys, so the desktop shell is stood in for by
 * a recording `__TAURI_INTERNALS__`: the test reads which keys the app asks the
 * shell to hold, and moves the keyboard between windows.
 */

const SHORTCUTS_SETTING = '/api/settings/app_settings/global_keyboard_shortcuts'
const SIDEBAR_SETTING = '/api/settings/app_settings/sidebar_configuration'
const SYSTEM_WIDE_SWITCH = /page keys from any program|din orice program/i

type ShortcutsConfig = Record<string, unknown>

async function savedShortcuts(
  request: APIRequestContext,
): Promise<ShortcutsConfig | null> {
  const response = await request.get(SHORTCUTS_SETTING)
  if (!response.ok()) return null
  const { data } = await response.json()
  return data?.value ? (JSON.parse(data.value) as ShortcutsConfig) : null
}

async function saveShortcuts(
  request: APIRequestContext,
  value: ShortcutsConfig | null,
) {
  await request.post('/api/settings/app_settings', {
    data: { key: 'global_keyboard_shortcuts', value: JSON.stringify(value) },
  })
}

/** Which window has the keyboard: one of ours, or null for another program. */
type FocusedWindow = 'main' | 'screen-1' | null

interface FakeShell {
  held: Set<string>
  focused: FocusedWindow
  emit: (event: string, windowLabel: string) => void
}

/**
 * Stands in for the desktop shell: records the keys it is asked to hold, and
 * moves the keyboard between the main window, a projection and another
 * program, sending each window's focus and blur events as Tauri does.
 */
async function fakeDesktopShell(page: Page) {
  await page.addInitScript(() => {
    type Target = { kind: string; label?: string }
    const callbacks = new Map<number, (event: unknown) => void>()
    const listeners: Array<{ event: string; target: Target; id: number }> = []
    let nextId = 1

    const shell = {
      held: new Set<string>(),
      focused: 'main' as string | null,
      emit(event: string, windowLabel: string) {
        for (const listener of listeners) {
          const hears =
            listener.target.kind === 'Any' ||
            listener.target.label === windowLabel
          if (listener.event !== event || !hears) continue
          callbacks.get(listener.id)?.({
            event,
            id: listener.id,
            payload: null,
          })
        }
      },
    }
    ;(window as unknown as { __shell: typeof shell }).__shell = shell
    document.hasFocus = () => shell.focused === 'main'

    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: 'main' },
        currentWebview: { windowLabel: 'main', label: 'main' },
      },
      transformCallback: (callback: (event: unknown) => void) => {
        const id = nextId++
        callbacks.set(id, callback)
        return id
      },
      unregisterCallback: (id: number) => callbacks.delete(id),
      convertFileSrc: (path: string) => path,
      invoke: async (
        command: string,
        args?: {
          shortcuts?: string[]
          label?: string
          event?: string
          target?: Target
          handler?: number
        },
      ) => {
        switch (command) {
          case 'plugin:global-shortcut|register':
            for (const key of args?.shortcuts ?? []) shell.held.add(key)
            return null
          case 'plugin:global-shortcut|unregister_all':
            shell.held.clear()
            return null
          case 'plugin:event|listen':
            listeners.push({
              event: args?.event ?? '',
              target: args?.target ?? { kind: 'Any' },
              id: args?.handler ?? 0,
            })
            return args?.handler
          case 'plugin:window|get_all_windows':
            return ['main', 'screen-1']
          case 'plugin:window|is_focused':
            return shell.focused === args?.label
          default:
            return null
        }
      },
    }
  })
}

/** Hands the keyboard to `to`, with the blur and focus events that go with it. */
async function moveKeyboard(page: Page, to: FocusedWindow) {
  await page.evaluate((next) => {
    const shell = (window as unknown as { __shell: FakeShell }).__shell
    const previous = shell.focused
    shell.focused = next
    if (previous) shell.emit('tauri://blur', previous)
    if (next) shell.emit('tauri://focus', next)
  }, to)
}

async function heldKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => [
    ...(window as unknown as { __shell: FakeShell }).__shell.held,
  ])
}

test.describe('Sidebar keys: app-level by default', () => {
  test.describe.configure({ mode: 'serial' })

  let original: ShortcutsConfig | null = null
  test.beforeAll(async ({ request }) => {
    original = await savedShortcuts(request)
  })
  test.afterAll(async ({ request }) => {
    if (original) await saveShortcuts(request, original)
  })

  test('the "from any program" switch is off by default and is saved', async ({
    page,
    request,
  }) => {
    await page.goto('/settings/shortcuts')
    const toggle = page.getByRole('switch', { name: SYSTEM_WIDE_SWITCH })
    await expect(toggle).toBeVisible({ timeout: 10000 })
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await page.screenshot({
      path: test.info().outputPath('settings-shortcuts.png'),
      fullPage: true,
    })

    await toggle.click()
    await expect
      .poll(async () => (await savedShortcuts(request))?.sidebarKeysSystemWide)
      .toBe(true)
    await page.reload()
    await expect(
      page.getByRole('switch', { name: SYSTEM_WIDE_SWITCH }),
    ).toHaveAttribute('aria-checked', 'true', { timeout: 10000 })

    await page.getByRole('switch', { name: SYSTEM_WIDE_SWITCH }).click()
    await expect
      .poll(async () => (await savedShortcuts(request))?.sidebarKeysSystemWide)
      .toBe(false)
  })

  test('by default the shell holds no sidebar key, and F6 still opens Bible in the app', async ({
    page,
    request,
  }) => {
    await saveShortcuts(request, {
      ...(original ?? { actions: {}, version: 1 }),
      sidebarKeysSystemWide: false,
    })
    await fakeDesktopShell(page)
    await page.goto('/songs')
    await page.waitForLoadState('networkidle')
    // Give the shortcut manager time to register what it is going to
    await page.waitForTimeout(1500)

    expect(await heldKeys(page)).not.toContain('F6')
    expect(await heldKeys(page)).not.toContain('F5')

    await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.blur(),
    )
    await page.keyboard.press('F6')
    await expect(page).toHaveURL(/\/bible/)
  })

  test('"from any program" has the shell hold the sidebar keys', async ({
    page,
    request,
  }) => {
    await saveShortcuts(request, {
      ...(original ?? { actions: {}, version: 1 }),
      sidebarKeysSystemWide: true,
    })
    await fakeDesktopShell(page)
    await page.goto('/songs')
    await page.waitForLoadState('networkidle')

    await expect.poll(() => heldKeys(page)).toContain('F6')
    expect(await heldKeys(page)).toEqual(
      expect.arrayContaining(['F4', 'F5', 'F6', 'F7']),
    )
  })

  test('page keys and "only when in front" keys are let go when the user leaves from a projection', async ({
    page,
    request,
  }) => {
    const sidebarBefore = (await (await request.get(SIDEBAR_SETTING)).json())
      .data.value as string
    try {
      // A presentation key held only while Church Hub is in front, and a key
      // the Bible page bound to "show slide"
      await saveShortcuts(request, {
        ...(original ?? { version: 1 }),
        actions: {
          ...((original?.actions as object | undefined) ?? {}),
          nextSlide: { shortcuts: ['F2'], enabled: true },
        },
        onlyWhenAppFocused: true,
        sidebarKeysSystemWide: false,
      })
      const sidebar = JSON.parse(sidebarBefore) as {
        items: Array<{ id: string; settings?: Record<string, unknown> }>
      }
      for (const item of sidebar.items) {
        if (item.id === 'bible') {
          item.settings = {
            ...item.settings,
            pageShortcuts: { showSlide: ['F3'] },
          }
        }
      }
      await request.post('/api/settings/app_settings', {
        data: { key: 'sidebar_configuration', value: JSON.stringify(sidebar) },
      })

      await fakeDesktopShell(page)
      await page.goto('/bible')
      await page.waitForLoadState('networkidle')
      await expect
        .poll(() => heldKeys(page))
        .toEqual(expect.arrayContaining(['F2', 'F3']))

      // Presenting hands the keyboard to the projection: still Church Hub
      await moveKeyboard(page, 'screen-1')
      await page.waitForTimeout(1000)
      expect(await heldKeys(page)).toEqual(expect.arrayContaining(['F2', 'F3']))

      // The user switches to another program from the projection
      await moveKeyboard(page, null)
      await expect.poll(() => heldKeys(page)).toEqual([])

      // And comes back to Church Hub
      await moveKeyboard(page, 'main')
      await expect
        .poll(() => heldKeys(page))
        .toEqual(expect.arrayContaining(['F2', 'F3']))
    } finally {
      await request.post('/api/settings/app_settings', {
        data: { key: 'sidebar_configuration', value: sidebarBefore },
      })
    }
  })
})
