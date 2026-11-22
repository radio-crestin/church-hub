import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test'

import { label } from './helpers/background-media'

/**
 * Settings → Screens says what each setting does and what the projector
 * shows when nothing is live (T-159). On the Adunare PC the clock was
 * missing on the projector because "close the window when nothing is shown"
 * was on, and nothing on the page said so. Each test makes its own screen.
 */

const TIME_TEXT = /^\d{1,2}:\d{2}(:\d{2})?$/

interface ScreenData {
  id: number
  closeOnEscape: boolean
  alwaysOnTop: boolean
  isFullscreen: boolean
  contentConfigs: Record<string, Record<string, unknown>>
}

async function createScreen(request: APIRequestContext) {
  const response = await request.post('/api/screens', {
    data: { name: `E2E Organized ${Date.now()}`, type: 'primary' },
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data.id as number
}

async function readScreen(
  request: APIRequestContext,
  id: number,
): Promise<ScreenData> {
  const response = await request.get(`/api/screens/${id}`)
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data
}

async function openCard(page: Page, id: number): Promise<Locator> {
  await page.goto('/settings/screens')
  const card = page.locator(
    `[data-testid="screen-card"][data-screen-id="${id}"]`,
  )
  await expect(card).toBeVisible({ timeout: 10000 })
  return card
}

/** Flips a switch of the card and waits until the server has it. */
async function flip(
  card: Locator,
  testId: string,
  expected: boolean,
  read: () => Promise<boolean>,
) {
  const control = card.getByTestId(testId)
  await expect(control).toHaveAttribute('aria-checked', String(!expected))
  await control.click()
  await expect.poll(read).toBe(expected)
  await expect(control).toHaveAttribute('aria-checked', String(expected))
}

test.describe('Screen settings are grouped and explained', () => {
  let screenId: number

  test.beforeEach(async ({ request }) => {
    screenId = await createScreen(request)
  })

  test.afterEach(async ({ request }) => {
    await request.delete(`/api/screens/${screenId}`)
  })

  test('each group is there, every switch has a name and a line on what it does', async ({
    page,
  }) => {
    const card = await openCard(page, screenId)

    const idle = card.getByTestId('screen-group-idle')
    const window = card.getByTestId('screen-group-window')
    await expect(
      idle.getByText(label('settings', 'sections.screens.groups.idle')),
    ).toBeVisible()
    await expect(
      window.getByText(label('settings', 'sections.screens.groups.window')),
    ).toBeVisible()
    await expect(idle.getByTestId('screen-idle-preview')).toBeVisible()

    for (const [group, key] of [
      [idle, 'closeOnEscape'],
      [window, 'window'],
      [window, 'openOnStartup'],
      [window, 'previewScreen'],
    ] as const) {
      const toggle = group.getByRole('switch', {
        name: label('settings', `sections.screens.${key}.label`),
      })
      await expect(toggle).toBeVisible()
      await expect(toggle).toHaveAccessibleDescription(
        label('settings', `sections.screens.${key}.description`),
      )
    }
    await expect(
      idle.getByRole('switch', {
        name: label('settings', 'sections.screens.idle.clock.label'),
      }),
    ).toBeVisible()

    // The rarely changed window options wait behind "More window options".
    const advanced = card.getByTestId('screen-group-advanced')
    await expect(card.getByTestId('screen-fullscreen')).toBeHidden()
    await advanced
      .getByText(label('settings', 'sections.screens.groups.advanced'))
      .click()
    await expect(card.getByTestId('screen-fullscreen')).toBeVisible()
    await expect(card.getByTestId('screen-always-on-top')).toBeVisible()
  })

  test('close-when-empty saves and the thumbnail says the window closes', async ({
    page,
    request,
  }) => {
    const card = await openCard(page, screenId)
    const preview = card.getByTestId('screen-idle-preview')
    await expect(preview).toHaveAttribute('data-closes', 'false')
    await expect(
      card.getByText(label('settings', 'sections.screens.idle.summaryOpen')),
    ).toBeVisible()

    const closes = async () =>
      (await readScreen(request, screenId)).closeOnEscape
    await flip(card, 'screen-close-on-escape', true, closes)
    await expect(preview).toHaveAttribute('data-closes', 'true')
    await expect(
      preview.getByText(
        label('settings', 'sections.screens.idle.windowCloses'),
      ),
    ).toBeVisible()
    await expect(
      card.getByText(label('settings', 'sections.screens.idle.summaryClosed')),
    ).toBeVisible()

    await flip(card, 'screen-close-on-escape', false, closes)
    await expect(preview).toHaveAttribute('data-closes', 'false')
  })

  test('the clock on the empty slide saves and shows on the projector', async ({
    page,
    browser,
    request,
  }) => {
    await request.post('/api/presentation/clear-temporary')
    const card = await openCard(page, screenId)
    const clockOn = async () =>
      !!(await readScreen(request, screenId)).contentConfigs.empty.clockEnabled
    const initially = await clockOn()

    const projector = await browser.newPage({
      storageState: await page.context().storageState(),
    })
    try {
      await projector.goto(`/screen/${screenId}`)
      const clock = projector.getByText(TIME_TEXT).filter({ visible: true })
      const thumbnailClock = card
        .getByTestId('screen-idle-preview')
        .getByText(TIME_TEXT)
        .filter({ visible: true })

      await flip(card, 'screen-idle-clock', !initially, clockOn)
      await expect(clock).toHaveCount(initially ? 0 : 1, { timeout: 10000 })
      await expect(thumbnailClock).toHaveCount(initially ? 0 : 1)

      await flip(card, 'screen-idle-clock', initially, clockOn)
      await expect(clock).toHaveCount(initially ? 1 : 0, { timeout: 10000 })
      await expect(thumbnailClock).toHaveCount(initially ? 1 : 0)
    } finally {
      await projector.close()
    }
  })

  test('a window option behind "More" still saves', async ({
    page,
    request,
  }) => {
    const card = await openCard(page, screenId)
    await card
      .getByTestId('screen-group-advanced')
      .getByText(label('settings', 'sections.screens.groups.advanced'))
      .click()
    const onTop = async () => (await readScreen(request, screenId)).alwaysOnTop
    const initially = await onTop()
    await flip(card, 'screen-always-on-top', !initially, onTop)
    await flip(card, 'screen-always-on-top', initially, onTop)
  })

  test('the editor separates the slide type from the whole screen, and an element has a way back', async ({
    page,
  }) => {
    const card = await openCard(page, screenId)
    // The thumbnail opens the empty slide's layout.
    await card.getByTestId('screen-idle-preview').click()
    await expect(page.getByTestId('screen-editor-content-type')).toHaveText(
      label('presentation', 'screens.contentTypes.empty'),
    )

    // On a song: the slide type's own settings, then the whole screen's.
    await page.getByTestId('screen-editor-content-type').click()
    await page
      .getByTestId('screen-editor-content-type-option')
      .filter({ hasText: label('presentation', 'screens.contentTypes.song') })
      .locator('button')
      .first()
      .click()
    const slideType = page.getByTestId('screen-editor-slide-type-settings')
    const wholeScreen = page.getByTestId('screen-editor-whole-screen-settings')
    await expect(slideType).toBeVisible()
    await expect(wholeScreen).toBeVisible()
    await expect(
      wholeScreen.getByText(
        label('presentation', 'screens.editor.wholeScreen'),
      ),
    ).toBeVisible()
    await expect(
      slideType.getByRole('switch', {
        name: label('presentation', 'screens.clock.enableForSlideType'),
      }),
    ).toBeVisible()

    // Picking the lyrics from the list opens their settings; back returns.
    await slideType.getByTestId('screen-editor-element-mainText').click()
    const element = page.getByTestId('screen-editor-element-settings')
    await expect(
      element.getByText(label('presentation', 'screens.elements.mainText')),
    ).toBeVisible()
    await expect(
      element
        .getByText(label('presentation', 'screens.textStyle.fontFamily'))
        .first(),
    ).toBeVisible()
    await page.getByTestId('screen-editor-back').click()
    await expect(slideType).toBeVisible()
  })

  test('the screens page and the editor fit a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const card = await openCard(page, screenId)
    const overflow = () =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )
    expect(await overflow()).toBeLessThanOrEqual(0)
    const cardBox = await card.boundingBox()
    expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(390)

    await card
      .getByRole('button', {
        name: label('settings', 'sections.screens.actions.edit'),
      })
      .click()
    await expect(page.getByTestId('screen-editor-save')).toBeVisible({
      timeout: 10000,
    })
    for (const testId of ['screen-editor-save', 'screen-editor-content-type']) {
      const box = await page.getByTestId(testId).boundingBox()
      expect(box!.x + box!.width, testId).toBeLessThanOrEqual(390)
    }
    expect(await overflow()).toBeLessThanOrEqual(0)
  })
})
