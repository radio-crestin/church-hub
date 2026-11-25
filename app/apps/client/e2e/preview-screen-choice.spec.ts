import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test'

import { label } from './helpers/background-media'

/**
 * One screen is "shown in the previews" (T-186): the Control Room and the
 * Bible, song and program previews all mirror it, rendered with its own
 * config. Without a choice it is the main screen, and deleting the chosen
 * screen falls back to it. The test's Stage screen is square, so which screen
 * a preview mirrors shows in the preview's own proportions.
 */

interface ScreenSummary {
  id: number
  name: string
  type: string
  isPreviewScreen: boolean
  sortOrder: number
  width: number
  height: number
}

/** The routes whose page carries a live preview, and the ones checked here. */
const PREVIEW_PAGES = ['/present', '/bible']

async function listScreens(request: APIRequestContext) {
  const response = await request.get('/api/screens')
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data as ScreenSummary[]
}

async function setPreviewFlag(
  request: APIRequestContext,
  screen: ScreenSummary,
  isPreviewScreen: boolean,
) {
  const response = await request.post('/api/screens', {
    data: {
      id: screen.id,
      name: screen.name,
      type: screen.type,
      isPreviewScreen,
    },
  })
  expect(response.ok()).toBeTruthy()
}

/** The main projector screen: the first primary one, by sort order. */
function mainScreenOf(screens: ScreenSummary[]) {
  const main = [...screens]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((s) => s.type === 'primary')
  expect(main, 'a main (primary) screen exists').toBeTruthy()
  return main as ScreenSummary
}

/** Width over height of the live preview on the page. */
async function previewRatio(page: Page) {
  const preview = page.getByTestId('live-preview')
  await expect(preview).toBeVisible({ timeout: 15000 })
  const box = await preview.boundingBox()
  return box ? box.width / box.height : 0
}

/** Every page with a preview mirrors `screen`: its picker and proportions. */
async function expectEveryPreviewMirrors(page: Page, screen: ScreenSummary) {
  for (const path of PREVIEW_PAGES) {
    await page.goto(path)
    await expect(page.getByTestId('preview-screen-picker')).toHaveValue(
      String(screen.id),
      { timeout: 15000 },
    )
    await expect
      .poll(() => previewRatio(page), { message: `preview on ${path}` })
      .toBeCloseTo(screen.width / screen.height, 1)
  }
}

/** The screen's "Shown in the previews" radio, under its "More options". */
async function previewRadio(page: Page, id: number): Promise<Locator> {
  await page.goto(`/settings/screens?screen=${id}`)
  const card = page.locator(
    `[data-testid="screen-card"][data-screen-id="${id}"]`,
  )
  await card
    .getByTestId('screen-group-advanced')
    .getByText(label('settings', 'sections.screens.groups.more'))
    .click()
  return card.getByRole('radio', {
    name: label('settings', 'sections.screens.previewScreen.label'),
  })
}

test.describe('The previews mirror the screen chosen for them', () => {
  test.describe.configure({ mode: 'serial' })

  let chosenBefore: ScreenSummary | undefined
  let stage: ScreenSummary

  test.beforeEach(async ({ request }) => {
    const screens = await listScreens(request)
    chosenBefore = screens.find((s) => s.isPreviewScreen)
    // No choice made: the previews start on the main screen.
    if (chosenBefore) await setPreviewFlag(request, chosenBefore, false)

    const response = await request.post('/api/screens', {
      data: {
        name: `E2E Preview Stage ${Date.now()}`,
        type: 'stage',
        width: 1000,
        height: 1000,
      },
    })
    expect(response.ok()).toBeTruthy()
    stage = (await response.json()).data
  })

  test.afterEach(async ({ request }) => {
    await request.delete(`/api/screens/${stage.id}`)
    if (chosenBefore) await setPreviewFlag(request, chosenBefore, true)
  })

  test('by default every preview mirrors the main screen', async ({
    page,
    request,
  }) => {
    const main = mainScreenOf(await listScreens(request))
    await expectEveryPreviewMirrors(page, main)

    // Settings say the same: the main screen is the one checked.
    await expect(await previewRadio(page, main.id)).toBeChecked({
      timeout: 10000,
    })
    await expect(await previewRadio(page, stage.id)).not.toBeChecked()
  })

  test('choosing Stage in Settings switches every preview to it', async ({
    page,
    request,
  }) => {
    const stageRadio = await previewRadio(page, stage.id)
    await stageRadio.click()
    await expect(stageRadio).toBeChecked()
    await expect
      .poll(async () =>
        (await listScreens(request))
          .filter((s) => s.isPreviewScreen)
          .map((s) => s.id),
      )
      .toEqual([stage.id])

    await expectEveryPreviewMirrors(page, stage)
  })

  test('choosing Stage from the preview picker switches every preview to it', async ({
    page,
    request,
  }) => {
    await page.goto('/present')
    await page
      .getByTestId('preview-screen-picker')
      .selectOption(String(stage.id))
    await expect
      .poll(
        async () =>
          (await listScreens(request)).find((s) => s.isPreviewScreen)?.id,
      )
      .toBe(stage.id)

    await expectEveryPreviewMirrors(page, stage)
  })

  test('deleting the chosen screen falls back to the main screen', async ({
    page,
    request,
  }) => {
    await setPreviewFlag(request, stage, true)
    await page.goto('/present')
    await expect(page.getByTestId('preview-screen-picker')).toHaveValue(
      String(stage.id),
      { timeout: 15000 },
    )

    // Deleted elsewhere: the open Control Room hears it and falls back.
    expect((await request.delete(`/api/screens/${stage.id}`)).ok()).toBeTruthy()
    const main = mainScreenOf(await listScreens(request))
    await expect(page.getByTestId('preview-screen-picker')).toHaveValue(
      String(main.id),
      { timeout: 15000 },
    )
    await expectEveryPreviewMirrors(page, main)
  })
})
