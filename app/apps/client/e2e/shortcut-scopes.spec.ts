import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * T-123. Each key works either only inside Church Hub or from any program, and
 * the user chooses per key (Settings → Shortcuts, next to the key).
 *  - Sidebar page keys (F4 Control Room, F5 Songs, F6 Bible, …) and page keys
 *    default to Church Hub only; presentation, livestream and OBS scene keys
 *    default to any program.
 *  - A Church Hub only sidebar key is never held by the desktop shell: the page
 *    runs it, so another program in front keeps the key.
 *  - Other Church Hub only keys are held while a Church Hub window has the
 *    keyboard, and let go as soon as none has it, whichever window lost it.
 *  - An any-program key is held all the time.
 *
 * A browser cannot press OS-wide keys, so the desktop shell is stood in for by
 * a recording `__TAURI_INTERNALS__`: the test reads which keys the app asks the
 * shell to hold, and moves the keyboard between windows.
 */

const SHORTCUTS_SETTING = '/api/settings/app_settings/global_keyboard_shortcuts'
const SIDEBAR_SETTING = '/api/settings/app_settings/sidebar_configuration'

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

const SCOPE_TOGGLE = (key: string) =>
  new RegExp(`where ${key} works|unde funcționează ${key}`, 'i')

test.describe('Shortcut scopes: where each key works', () => {
  test.describe.configure({ mode: 'serial' })

  let original: ShortcutsConfig | null = null
  let sidebarBefore = ''

  const withScopes = (
    keyScopes: Record<string, string>,
    extra: ShortcutsConfig = {},
  ): ShortcutsConfig => ({
    ...(original ?? { actions: {}, version: 1 }),
    ...extra,
    keyScopes,
  })

  test.beforeAll(async ({ request }) => {
    original = await savedShortcuts(request)
    sidebarBefore = (await (await request.get(SIDEBAR_SETTING)).json()).data
      .value as string
  })
  test.afterAll(async ({ request }) => {
    if (original) await saveShortcuts(request, original)
    await request.post('/api/settings/app_settings', {
      data: { key: 'sidebar_configuration', value: sidebarBefore },
    })
  })

  test('each key has its own switch, Church Hub only by default for page keys', async ({
    page,
    request,
  }) => {
    await saveShortcuts(request, withScopes({}))
    await page.goto('/settings/shortcuts')
    // The switch belongs to the key: F5 shows up in Songs' two lists, and
    // both follow it
    const songsKeys = page.getByRole('switch', { name: SCOPE_TOGGLE('F5') })
    const bibleKey = page
      .getByRole('switch', { name: SCOPE_TOGGLE('F6') })
      .first()
    await expect(songsKeys.first()).toBeVisible({ timeout: 10000 })
    await expect(songsKeys.first()).toHaveAttribute('aria-checked', 'false')
    await expect(bibleKey).toHaveAttribute('aria-checked', 'false')

    await songsKeys.first().click()
    await expect
      .poll(async () => (await savedShortcuts(request))?.keyScopes)
      .toEqual({ F5: 'system' })
    await page.reload()
    for (const toggle of await songsKeys.all()) {
      await expect(toggle).toHaveAttribute('aria-checked', 'true', {
        timeout: 10000,
      })
    }
    await expect(bibleKey).toHaveAttribute('aria-checked', 'false')
    await songsKeys.first().scrollIntoViewIfNeeded()
    await page.screenshot({ path: test.info().outputPath('settings.png') })
  })

  test('by default the shell holds no sidebar key, and F6 still opens Bible in the app', async ({
    page,
    request,
  }) => {
    await saveShortcuts(request, withScopes({}))
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

  test('a sidebar key set to any program is held, also with another program in front', async ({
    page,
    request,
  }) => {
    await saveShortcuts(request, withScopes({ F5: 'system' }))
    await fakeDesktopShell(page)
    await page.goto('/songs')
    await page.waitForLoadState('networkidle')

    await expect.poll(() => heldKeys(page)).toContain('F5')
    await moveKeyboard(page, null)
    await page.waitForTimeout(1000)
    expect(await heldKeys(page)).toContain('F5')
    expect(await heldKeys(page)).not.toContain('F6')
  })

  test('Church Hub only keys are let go when the user leaves from a projection; any-program keys stay', async ({
    page,
    request,
  }) => {
    // Slide keys: F2 Church Hub only, F1 any program (their default). F3 is a
    // key the Bible page bound to "show slide": Church Hub only by default.
    const actions = (original?.actions as object | undefined) ?? {}
    await saveShortcuts(
      request,
      withScopes(
        { F2: 'app' },
        {
          actions: {
            ...actions,
            nextSlide: { shortcuts: ['F2'], enabled: true },
            prevSlide: { shortcuts: ['F1'], enabled: true },
          },
        },
      ),
    )
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
      .toEqual(expect.arrayContaining(['F1', 'F2', 'F3']))

    // Presenting hands the keyboard to the projection: still Church Hub
    await moveKeyboard(page, 'screen-1')
    await page.waitForTimeout(1000)
    expect(await heldKeys(page)).toEqual(
      expect.arrayContaining(['F1', 'F2', 'F3']),
    )

    // The user switches to another program from the projection
    await moveKeyboard(page, null)
    await expect.poll(() => heldKeys(page)).toEqual(['F1'])

    // And comes back to Church Hub
    await moveKeyboard(page, 'main')
    await expect
      .poll(() => heldKeys(page))
      .toEqual(expect.arrayContaining(['F1', 'F2', 'F3']))
  })
})
