import {
  type APIRequestContext,
  type Browser,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * A projector that opens while a screen setting is being saved has to end up
 * with the saved setting. Its first load of the screen can be answered with
 * the old setting while the change is broadcast to a socket not yet open, or
 * while that first load is still on its way; the idle clock then stayed on
 * after it was turned off.
 */

const TIME_TEXT = /^\d{1,2}:\d{2}(:\d{2})?$/

let screenId: number
let emptySlide: Record<string, unknown>

test.beforeEach(async ({ request }) => {
  const created = await request.post('/api/screens', {
    data: { name: `E2E Socket gap ${Date.now()}`, type: 'primary' },
  })
  expect(created.ok()).toBeTruthy()
  screenId = (await created.json()).data.id
  await request.post('/api/presentation/clear-temporary')
  const screen = await request.get(`/api/screens/${screenId}`)
  emptySlide = (await screen.json()).data.contentConfigs.empty
  expect(emptySlide.clockEnabled).toBe(true)
})

test.afterEach(async ({ request }) => {
  await request.delete(`/api/screens/${screenId}`)
})

async function openProjectorPage(page: Page, browser: Browser) {
  await page.goto('/')
  return browser.newPage({ storageState: await page.context().storageState() })
}

async function turnIdleClockOff(request: APIRequestContext) {
  const saved = await request.put(`/api/screens/${screenId}/config/empty`, {
    data: { config: { ...emptySlide, clockEnabled: false } },
  })
  expect(saved.ok()).toBeTruthy()
}

test('a setting saved before the projector socket opens still reaches it', async ({
  browser,
  page,
  request,
}) => {
  const projector = await openProjectorPage(page, browser)
  try {
    let openSocket!: () => void
    const socketMayOpen = new Promise<void>((resolve) => {
      openSocket = resolve
    })
    await projector.routeWebSocket('**/ws', async (ws) => {
      await socketMayOpen
      ws.connectToServer()
    })

    await projector.goto(`/screen/${screenId}`)
    const clock = projector.getByText(TIME_TEXT).filter({ visible: true })
    await expect(clock).toHaveCount(1, { timeout: 10000 })

    await turnIdleClockOff(request)
    openSocket()

    await expect(clock).toHaveCount(0, { timeout: 10000 })
  } finally {
    await projector.close()
  }
})

test('a setting saved while the projector first loads the screen still reaches it', async ({
  browser,
  page,
  request,
}) => {
  const projector = await openProjectorPage(page, browser)
  try {
    // The first load reads the screen before the save but answers after it.
    let firstLoadRead!: () => void
    const firstLoadHasRead = new Promise<void>((resolve) => {
      firstLoadRead = resolve
    })
    let answerFirstLoad!: () => void
    const firstLoadMayAnswer = new Promise<void>((resolve) => {
      answerFirstLoad = resolve
    })
    let held = false
    await projector.route(`**/api/screens/${screenId}`, async (route) => {
      if (held) return route.continue()
      held = true
      const response = await route.fetch()
      firstLoadRead()
      await firstLoadMayAnswer
      await route.fulfill({ response })
    })
    const socket = projector.waitForEvent('websocket')
    let loads = 0
    const refetched = projector.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/screens/${screenId}`) && ++loads === 2,
      { timeout: 10000 },
    )

    await projector.goto(`/screen/${screenId}`)
    const updateReceived = (await socket).waitForEvent('framereceived', {
      predicate: (frame) =>
        String(frame.payload).includes('"screen_config_updated"'),
    })
    await firstLoadHasRead
    await turnIdleClockOff(request)
    await updateReceived
    answerFirstLoad()

    // The update has to load the screen again, after the save.
    await refetched
    const clock = projector.getByText(TIME_TEXT).filter({ visible: true })
    await expect(projector.getByTestId('screen-renderer-root')).toBeAttached()
    await expect(clock).toHaveCount(0, { timeout: 10000 })
  } finally {
    await projector.close()
  }
})
