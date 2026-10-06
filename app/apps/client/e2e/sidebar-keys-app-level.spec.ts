import { type APIRequestContext, expect, type Page, test } from '@playwright/test'

/**
 * T-123. Sidebar page keys (F4 Present, F5 Songs, F6 Bible, …) work only while
 * Church Hub has the keyboard, unless Settings → Shortcuts says "from any
 * program". App-level keys are never held by the desktop shell OS-wide: the
 * page handles the press itself, so another program in front keeps its keys.
 *
 * A browser cannot press OS-wide keys, so the desktop shell is stood in for by
 * a recording `__TAURI_INTERNALS__`: the test reads which keys the app asks the
 * shell to hold.
 */

const SHORTCUTS_SETTING = '/api/settings/app_settings/global_keyboard_shortcuts'
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

/** Stands in for the desktop shell and records the keys it is asked to hold. */
async function fakeDesktopShell(page: Page) {
  await page.addInitScript(() => {
    const held = new Set<string>()
    let nextCallbackId = 1
    const w = window as unknown as Record<string, unknown>
    w.__heldKeys = held
    w.__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: 'main' },
        currentWebview: { windowLabel: 'main', label: 'main' },
      },
      transformCallback: () => nextCallbackId++,
      unregisterCallback: () => {},
      convertFileSrc: (path: string) => path,
      invoke: async (command: string, args?: { shortcuts?: string[] }) => {
        if (command === 'plugin:global-shortcut|register') {
          for (const key of args?.shortcuts ?? []) held.add(key)
        } else if (command === 'plugin:global-shortcut|unregister_all') {
          held.clear()
        } else if (command === 'plugin:window|get_all_windows') {
          return ['main']
        } else if (command === 'plugin:window|is_focused') {
          return true
        }
        return null
      },
    }
  })
}

async function heldKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => [
    ...((window as unknown as { __heldKeys: Set<string> }).__heldKeys ?? []),
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
})
