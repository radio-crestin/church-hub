import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'
import {
  makeJpeg,
  postFrame,
  readCenterPixel,
  startFrameFeed,
  startShare,
  stopShare,
} from './helpers/screenShare'

/**
 * Screen sharing is native: the desktop app captures a screen or window in
 * Rust and sends JPEG frames to the server, which streams them to the browser
 * screens; the desktop projector windows let Rust draw them with the GPU. A
 * browser-only operator shares with getDisplayMedia into the same ingest.
 */

interface ShellCall {
  command: string
  args: Record<string, unknown>
}

const SOURCES = [
  {
    id: 'monitor:1',
    kind: 'monitor',
    name: 'Main display',
    appName: null,
    width: 1920,
    height: 1080,
    thumbnail: null,
  },
  {
    id: 'window:42',
    kind: 'window',
    name: 'Sermon.pptx - PowerPoint',
    appName: 'PowerPoint',
    width: 1600,
    height: 900,
    thumbnail: null,
  },
]

/**
 * Makes the page believe it runs in the desktop shell as window `label`; the
 * screen-capture commands answer as Rust would, `gpu` saying whether the GPU
 * can draw on the projector windows.
 */
async function fakeDesktopShell(page: Page, label: string, gpu = true) {
  await page.addInitScript(
    ({ label, sources, gpu }) => {
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
            calls.push({
              command,
              args: JSON.parse(JSON.stringify(args ?? {})),
            })
            switch (command) {
              case 'get_server_config':
                return { serverPort: Number(window.location.port) }
              case 'plugin:window|get_all_windows':
                return [label]
              case 'screen_capture_sources':
                return sources
              case 'screen_share_surface_show':
                return gpu
              default:
                return null
            }
          },
        },
      })
    },
    { label, sources: SOURCES, gpu },
  )
}

async function shellCalls(page: Page, command: string): Promise<ShellCall[]> {
  const calls = await page.evaluate(
    () => (window as unknown as { __shellCalls: ShellCall[] }).__shellCalls,
  )
  return calls.filter((call) => call.command === command)
}

async function createScreen(request: APIRequestContext) {
  const created = await request.post('/api/screens', {
    data: { name: `E2E Native Share ${Date.now()}`, type: 'primary' },
  })
  return (await created.json()).data.id as number
}

test.afterEach(async ({ request }) => {
  await stopShare(request).catch(() => undefined)
})

test('the frame ingest takes frames only with the running share token', async ({
  page,
  request,
}) => {
  await page.goto('/')
  const jpeg = await makeJpeg(page, '#10c010')

  expect((await postFrame(request, 'nope', jpeg)).status()).toBe(409)
  expect((await request.get('/api/screen-share/stream.mjpg')).status()).toBe(
    404,
  )

  const first = await startShare(request)
  expect((await postFrame(request, first, jpeg)).status()).toBe(204)
  expect((await postFrame(request, 'wrong', jpeg)).status()).toBe(403)

  // A new share replaces the old one: its token no longer works.
  const second = await startShare(request)
  expect(second).not.toBe(first)
  expect((await postFrame(request, first, jpeg)).status()).toBe(403)
  expect((await postFrame(request, second, jpeg)).status()).toBe(204)

  const state = await (await request.get('/api/presentation/state')).json()
  expect(state.data.temporaryContent.type).toBe('screen_share')

  await stopShare(request)
  expect((await postFrame(request, second, jpeg)).status()).toBe(409)
})

test('a stream opened before the first frame connects at once and gets it', async ({
  page,
  request,
}) => {
  await page.goto('/')
  const jpeg = await makeJpeg(page, '#10c010')
  const token = await startShare(request)

  // The screens open the stream as the share starts, before any frame.
  const headersAfterMs = await page.evaluate(async () => {
    const started = performance.now()
    const response = await fetch('/api/screen-share/stream.mjpg')
    const elapsed = performance.now() - started
    const reader = response.body?.getReader()
    Object.assign(window, {
      __mjpeg: { reader, type: response.headers.get('content-type') },
    })
    return elapsed
  })
  expect(headersAfterMs).toBeLessThan(2_000)

  expect((await postFrame(request, token, jpeg)).status()).toBe(204)

  const firstPart = await page.evaluate(async () => {
    const { reader, type } = (
      window as unknown as {
        __mjpeg: {
          reader: ReadableStreamDefaultReader<Uint8Array>
          type: string
        }
      }
    ).__mjpeg
    let text = ''
    while (!text.includes('Content-Type: image/jpeg')) {
      const { value, done } = await reader.read()
      if (done) break
      text += new TextDecoder('latin1').decode(value)
    }
    await reader.cancel()
    return {
      type,
      hasFrame: text.includes('--frame\r\nContent-Type: image/jpeg'),
    }
  })
  expect(firstPart.type).toContain('multipart/x-mixed-replace')
  expect(firstPart.hasFrame).toBe(true)
})

test('other content replacing the share ends it', async ({ page, request }) => {
  await page.goto('/')
  const jpeg = await makeJpeg(page, '#10c010')
  const token = await startShare(request)
  expect((await postFrame(request, token, jpeg)).status()).toBe(204)

  await request.post('/api/presentation/clear-temporary')
  expect((await postFrame(request, token, jpeg)).status()).toBe(409)
})

test('a browser operator shares with getDisplayMedia into the same stream', async ({
  page,
  browser,
  request,
}) => {
  const screenId = await createScreen(request)
  // The browser's share dialog, answered with a green "screen".
  await page.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 450
      const context = canvas.getContext('2d')
      const paint = () => {
        if (!context) return
        context.fillStyle = '#10c010'
        context.fillRect(0, 0, canvas.width, canvas.height)
      }
      paint()
      setInterval(paint, 100)
      return canvas.captureStream(10)
    }
  })

  await setAppLanguage(page, 'en')
  try {
    await page.goto('/present')
    await page.getByRole('button', { name: 'Share Screen' }).click()

    const projection = await browser.newPage({
      viewport: { width: 800, height: 450 },
    })
    await projection.goto(`/screen/${screenId}`)
    const stream = projection.getByTestId('screen-share-view').locator('img')
    await expect
      .poll(() => readCenterPixel(stream), { timeout: 20_000 })
      .toEqual(expect.objectContaining({ isGreen: true }))

    await page.getByRole('button', { name: 'Stop Sharing' }).click()
    await expect(projection.getByTestId('screen-share-view')).toBeHidden({
      timeout: 10_000,
    })
    await expect(
      page.getByRole('button', { name: 'Share Screen' }),
    ).toBeVisible()
    await projection.close()
  } finally {
    await request.delete(`/api/screens/${screenId}`)
  }
})

test('the desktop app picks a window and captures it natively', async ({
  page,
  request,
}) => {
  await fakeDesktopShell(page, 'main')
  await setAppLanguage(page, 'en')
  await page.goto('/present')
  await page.getByRole('button', { name: 'Share Screen' }).click()

  const picker = page.getByRole('dialog', { name: 'Share a screen or window' })
  await expect(picker).toBeVisible()
  await expect(picker.getByRole('heading', { name: 'Screens' })).toBeVisible()
  await expect(picker.getByRole('heading', { name: 'Windows' })).toBeVisible()
  await picker
    .getByRole('button', { name: /Sermon\.pptx - PowerPoint/ })
    .click()
  await expect(picker).toBeHidden()

  // Rust is asked to capture that window with a fresh ingest token...
  await expect
    .poll(async () => (await shellCalls(page, 'screen_capture_start')).length)
    .toBe(1)
  const [start] = await shellCalls(page, 'screen_capture_start')
  expect(start.args.sourceId).toBe('window:42')
  const token = start.args.token as string

  // ...which its frames are accepted with, and the share is on the screens.
  const jpeg = await makeJpeg(page, '#10c010')
  expect((await postFrame(request, token, jpeg)).status()).toBe(204)
  await expect(page.getByRole('button', { name: 'Stop Sharing' })).toBeVisible()

  await page.getByRole('button', { name: 'Stop Sharing' }).click()
  await expect
    .poll(async () => (await shellCalls(page, 'screen_capture_stop')).length)
    .toBeGreaterThan(0)
  expect((await postFrame(request, token, jpeg)).status()).toBe(409)
})

for (const gpu of [true, false]) {
  test(`a projector window ${gpu ? 'lets the GPU draw the share over its area' : 'shows the stream when the GPU cannot draw'}`, async ({
    browser,
    request,
  }) => {
    const projection = await browser.newPage({
      viewport: { width: 1000, height: 500 },
    })
    const screenId = await createScreen(request)
    const token = await startShare(request)
    const feed = startFrameFeed(
      request,
      token,
      await makeJpeg(projection, '#e01010'),
    )

    try {
      await fakeDesktopShell(projection, `display-${screenId}`, gpu)
      await projection.goto(`/screen/${screenId}`)
      const view = projection.getByTestId('screen-share-view')
      await expect(view).toBeVisible({ timeout: 15_000 })
      const surface = view.locator(
        `[data-renderer="${gpu ? 'gpu' : 'stream'}"]`,
      )
      await expect(surface).toBeVisible()

      // Rust is told exactly where the share sits and how it fits.
      const box = await surface.boundingBox()
      const shows = await shellCalls(projection, 'screen_share_surface_show')
      const last = shows.at(-1)?.args as {
        rect: { x: number; y: number; width: number; height: number }
        objectFit: string
      }
      expect(last.objectFit).toBe('contain')
      expect(Math.round(last.rect.width)).toBe(Math.round(box?.width ?? 0))
      expect(Math.round(last.rect.height)).toBe(Math.round(box?.height ?? 0))

      if (gpu) {
        await expect(view.locator('img')).toHaveCount(0)
      } else {
        await expect
          .poll(() => readCenterPixel(view.locator('img')), { timeout: 15_000 })
          .toEqual(expect.objectContaining({ isRed: true }))
      }

      await stopShare(request)
      await expect(view).toBeHidden({ timeout: 10_000 })
      await expect
        .poll(
          async () =>
            (await shellCalls(projection, 'screen_share_surface_hide')).length,
        )
        .toBeGreaterThan(0)
    } finally {
      feed.stop()
      await request.delete(`/api/screens/${screenId}`)
      await projection.close()
    }
  })
}
