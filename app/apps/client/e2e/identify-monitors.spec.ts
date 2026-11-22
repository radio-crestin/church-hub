import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * Settings → Screens → "Identify" puts a plate in the middle of every display
 * with the monitor's number, name and resolution, the ones the Monitor picker
 * lists, and takes it away by itself (T-166). On the Adunare PC the badge
 * windows showed the app's start-up error, "get_server_config not allowed by
 * ACL", squeezed into a small box in a corner instead of a number: the
 * capability for windows loading the app from the sidecar left them out.
 *
 * A browser has no displays, so the desktop shell is stood in for: it reports
 * the Adunare PC's three monitors, one of them scaled, and records the windows
 * the app asks it for.
 */

interface Monitor {
  name: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  scaleFactor: number
}

/** The Adunare PC's desk, with the projector scaled to 125%. */
const MONITORS: Monitor[] = [
  {
    name: '\\\\.\\DISPLAY1',
    position: { x: 0, y: 0 },
    size: { width: 1920, height: 1080 },
    scaleFactor: 1,
  },
  {
    name: '\\\\.\\DISPLAY2',
    position: { x: 1920, y: 159 },
    size: { width: 1024, height: 768 },
    scaleFactor: 1,
  },
  {
    name: '\\\\.\\DISPLAY3',
    position: { x: -1280, y: -121 },
    size: { width: 1280, height: 960 },
    scaleFactor: 1.25,
  },
]

interface ShellCall {
  command: string
  args: Record<string, unknown>
}

/** Makes the page believe it runs in the desktop shell, as window `label`. */
async function fakeDesktopShell(page: Page, label = 'main') {
  await page.addInitScript(
    ({ monitors, label }) => {
      const calls: Array<{ command: string; args: unknown }> = []
      Object.assign(window, {
        __shellCalls: calls,
        __TAURI_EVENT_PLUGIN_INTERNALS__: {
          unregisterListener: () => undefined,
        },
        __TAURI_INTERNALS__: {
          metadata: {
            currentWindow: { label },
            currentWebview: { windowLabel: label, label },
          },
          transformCallback: () => 0,
          unregisterCallback: () => undefined,
          convertFileSrc: (path: string) => path,
          invoke: async (command: string, args?: unknown) => {
            // As the shell receives them: positions and sizes in their IPC form
            calls.push({
              command,
              args: JSON.parse(JSON.stringify(args ?? {})),
            })
            switch (command) {
              case 'get_server_config':
                return { serverPort: Number(window.location.port) }
              case 'plugin:window|available_monitors':
                return monitors.map((monitor) => ({
                  ...monitor,
                  workArea: { position: monitor.position, size: monitor.size },
                }))
              case 'plugin:window|get_all_windows':
                return [label]
              default:
                return null
            }
          },
        },
      })
    },
    { monitors: MONITORS, label },
  )
}

async function shellCalls(page: Page, prefix: string): Promise<ShellCall[]> {
  const calls = await page.evaluate(
    () => (window as unknown as { __shellCalls: ShellCall[] }).__shellCalls,
  )
  return calls.filter((call) => call.command.startsWith(prefix))
}

/** The calls the shell got for one window. */
function forWindow(calls: ShellCall[], label: string) {
  return calls.filter((call) => call.args.label === label)
}

async function createScreen(request: APIRequestContext) {
  const response = await request.post('/api/screens', {
    data: { name: `E2E Identify ${Date.now()}`, type: 'primary' },
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data.id as number
}

test.describe('Identify monitors', () => {
  let screenId: number

  test.beforeEach(async ({ request }) => {
    screenId = await createScreen(request)
  })

  test.afterEach(async ({ request }) => {
    await request.delete(`/api/screens/${screenId}`)
  })

  test('a plate in the middle of every display, named as the picker names it', async ({
    page,
  }) => {
    await fakeDesktopShell(page)
    await page.goto('/settings/screens')
    const card = page.locator(
      `[data-testid="screen-card"][data-screen-id="${screenId}"]`,
    )
    await expect(card).toBeVisible({ timeout: 15000 })

    await card.getByRole('button', { name: /^(Identify|Identifică)$/ }).click()

    await expect
      .poll(async () => (await shellCalls(page, 'plugin:window|show')).length)
      .toBe(3)
    const created = (await shellCalls(page, 'plugin:webview|create')).map(
      (call) => call.args.options as Record<string, unknown>,
    )
    const placed = await shellCalls(page, 'plugin:window|set_')

    for (const [index, monitor] of MONITORS.entries()) {
      const number = index + 1
      const options = created.find((option) =>
        String(option.label).startsWith(`monitor-badge-${number}-`),
      )
      expect(options, `badge ${number} created`).toBeTruthy()
      const label = String(options?.label)

      // Number, name and resolution, as the picker lists the monitor
      const url = new URL(String(options?.url))
      expect(url.pathname).toBe(`/monitor-badge/${number}`)
      expect(url.searchParams.get('name')).toBe(monitor.name)
      expect(url.searchParams.get('size')).toBe(
        `${monitor.size.width}×${monitor.size.height}`,
      )
      // Built hidden and out of the keyboard's way, then placed and shown
      expect(options).toMatchObject({
        visible: false,
        focus: false,
        focusable: false,
        decorations: false,
        alwaysOnTop: true,
      })

      // Half the display, centred, in the desktop's own pixels: the scaled
      // projector gets its frame in physical pixels, not logical ones
      const width = monitor.size.width / 2
      const height = monitor.size.height / 2
      const x = monitor.position.x + width / 2
      const y = monitor.position.y + height / 2
      const own = forWindow(placed, label)
      expect(
        own.find((c) => c.command === 'plugin:window|set_size')?.args,
      ).toMatchObject({ value: { Physical: { width, height } } })
      expect(
        own.find((c) => c.command === 'plugin:window|set_position')?.args,
      ).toMatchObject({ value: { Physical: { x, y } } })
    }

    // The picker lists the same number and name the plates show
    await card.getByTestId('screen-monitor-picker').click()
    for (const [index, monitor] of MONITORS.entries()) {
      await expect(
        page
          .getByTestId('screen-monitor-picker-option')
          .filter({ hasText: `${index + 1} · ${monitor.name}` }),
      ).toContainText(`${monitor.size.width}×${monitor.size.height}`)
    }
  })

  test('the plate shows its number and name at once, then closes itself', async ({
    page,
  }) => {
    await fakeDesktopShell(page, 'monitor-badge-3')
    const started = Date.now()
    await page.goto(
      `/monitor-badge/3?${new URLSearchParams({ name: '\\\\.\\DISPLAY3', size: '1280×960' })}`,
    )

    // No app loading page in the badge, only the plate
    await expect(page.locator('#loading-content')).toBeHidden()
    const number = page.getByTestId('monitor-badge-number')
    await expect(number).toHaveText('3')
    await expect(page.getByTestId('monitor-badge-name')).toHaveText(
      '\\\\.\\DISPLAY3',
    )
    await expect(page.getByTestId('monitor-badge-size')).toHaveText('1280×960')
    await expect(page.locator('#loading-screen')).toHaveCount(0)

    // Big and centred in its window
    const viewport = page.viewportSize()
    const box = await number.boundingBox()
    if (!viewport || !box) throw new Error('badge number not laid out')
    expect(box.height).toBeGreaterThan(viewport.height * 0.35)
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(
      viewport.width * 0.02,
    )

    // It never waited on the server's start-up, and goes after three seconds
    expect(await shellCalls(page, 'get_server_config')).toHaveLength(0)
    await expect
      .poll(
        async () => (await shellCalls(page, 'plugin:window|close')).length,
        {
          timeout: 8000,
        },
      )
      .toBe(1)
    expect(Date.now() - started).toBeGreaterThanOrEqual(3000)
  })

  test('every window that loads the app from the sidecar may run its commands', () => {
    // The desktop shell refuses a window the remote capability does not name,
    // and the window shows the start-up error instead of its page (CH-138,
    // T-166). Every window but the main one loads from the sidecar.
    const capabilities = join(
      dirname(fileURLToPath(import.meta.url)),
      '../../../tauri/capabilities',
    )
    const windows = (file: string): string[] =>
      JSON.parse(readFileSync(join(capabilities, file), 'utf8')).windows
    const remote = windows('remote.json')
    expect(remote).toContain('monitor-badge-*')
    for (const label of windows('default.json')) {
      if (label !== 'main') expect(remote).toContain(label)
    }
  })
})
