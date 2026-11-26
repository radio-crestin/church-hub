import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { label } from './helpers/background-media'

/**
 * Copying, pasting and locking an element's position in the screen editor
 * (T-028): «ne trebuie o funcție să fixăm/copiem poziția anumitor elemente».
 */

const pct = (value: number) => ({ enabled: true, value, unit: '%' })

async function createScreen(
  request: APIRequestContext,
  extra: Record<string, unknown> = {},
): Promise<number> {
  const response = await request.post('/api/screens', {
    data: { name: `E2E Position ${Date.now()}`, type: 'primary', ...extra },
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data.id as number
}

async function configs(request: APIRequestContext, screenId: number) {
  const { data } = await (await request.get(`/api/screens/${screenId}`)).json()
  return data.contentConfigs
}

/** Moves the song lyrics to a place no default uses. */
async function placeSongLyrics(
  request: APIRequestContext,
  screenId: number,
  constraints: Record<string, unknown>,
) {
  const { song } = await configs(request, screenId)
  song.mainText = { ...song.mainText, constraints }
  const put = await request.put(`/api/screens/${screenId}/config/song`, {
    data: { config: song },
  })
  expect(put.ok()).toBeTruthy()
}

async function openEditor(page: Page, screenId: number) {
  await page.goto(`/settings/screens?screen=${screenId}`)
  await page
    .locator(`[data-testid="screen-card"][data-screen-id="${screenId}"]`)
    .getByRole('button', {
      name: label('settings', 'sections.screens.actions.edit'),
    })
    .click()
  await expect(page.getByTestId('screen-editor-save')).toBeVisible({
    timeout: 10000,
  })
}

async function pickSlideType(page: Page, type: string) {
  // The slide, from the theme's slides on the left.
  await page.getByTestId(`screen-editor-slide-${type}`).click()
}

async function save(page: Page) {
  await page.getByTestId('screen-editor-save').click()
  await expect(page.getByTestId('screen-editor-unsaved')).toHaveCount(0)
}

/** Drags an element of the canvas by (dx, dy) pixels. */
async function drag(page: Page, type: string, dx: number, dy: number) {
  const box = await page
    .getByTestId(`screen-editor-canvas-${type}`)
    .boundingBox()
  if (!box) throw new Error(`${type} is not on the canvas`)
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 8 })
  await page.mouse.up()
}

test.describe('Screen editor: copy, paste and lock a position', () => {
  const screens: number[] = []

  test.afterEach(async ({ request }) => {
    for (const id of screens.splice(0)) {
      await request.delete(`/api/screens/${id}`).catch(() => {})
    }
  })

  test("the song's place is pasted on the Bible verse", async ({
    page,
    request,
  }) => {
    const screenId = await createScreen(request)
    screens.push(screenId)
    const place = {
      top: pct(20),
      right: pct(30),
      bottom: pct(25),
      left: pct(10),
    }
    await placeSongLyrics(request, screenId, place)

    await openEditor(page, screenId)
    await pickSlideType(page, 'song')
    await page.getByTestId('screen-editor-element-mainText').click()
    await expect(
      page.getByTestId('screen-editor-paste-position'),
    ).toBeDisabled()
    await page.getByTestId('screen-editor-copy-position').click()

    await pickSlideType(page, 'bible')
    await page.getByTestId('screen-editor-element-contentText').click()
    await page.getByTestId('screen-editor-paste-position').click()
    await save(page)

    const saved = await configs(request, screenId)
    expect(saved.bible.contentText.constraints).toEqual(place)
    expect(saved.bible.contentText.size).toEqual(saved.song.mainText.size)
  })

  test('a copied position reaches another screen, pixels scaled to it', async ({
    page,
    request,
  }) => {
    const from = await createScreen(request)
    const to = await createScreen(request, { width: 1280, height: 720 })
    screens.push(from, to)
    // 192 px from the left of a 1920 px screen is 128 px on a 1280 px one.
    const place = {
      top: pct(15),
      right: pct(40),
      bottom: pct(30),
      left: { enabled: true, value: 192, unit: 'px' },
    }
    await placeSongLyrics(request, from, place)

    await openEditor(page, from)
    await page.getByTestId('screen-editor-element-mainText').click()
    await page.getByTestId('screen-editor-copy-position').click()

    // The copy outlives the editor: another screen's editor pastes it.
    await openEditor(page, to)
    await page.getByTestId('screen-editor-element-mainText').click()
    await page.getByTestId('screen-editor-paste-position').click()
    await save(page)

    const { song } = await configs(request, to)
    expect(song.mainText.constraints).toEqual({
      ...place,
      left: { enabled: true, value: 128, unit: 'px' },
    })
  })

  test('a locked element stays put until it is unlocked', async ({
    page,
    request,
  }) => {
    const screenId = await createScreen(request)
    screens.push(screenId)

    await openEditor(page, screenId)
    await page.getByTestId('screen-editor-element-mainText').click()
    await page.getByTestId('screen-editor-lock-position').click()
    await expect(
      page.getByTestId('screen-editor-lock-position'),
    ).toHaveAttribute('aria-pressed', 'true')
    const settings = page.getByTestId('screen-editor-element-settings')
    await expect(settings.locator('fieldset input').first()).toBeDisabled()
    await expect(
      page.getByTestId('screen-editor-paste-position'),
    ).toBeDisabled()
    await save(page)

    const before = (await configs(request, screenId)).song.mainText
    expect(before.locked).toBe(true)

    // Dragging a locked element on the canvas moves nothing.
    await openEditor(page, screenId)
    const canvasText = page.getByTestId('screen-editor-canvas-mainText')
    await expect(
      canvasText.getByTestId('screen-editor-element-locked'),
    ).toBeVisible()
    await drag(page, 'mainText', 120, 60)
    await expect(page.getByTestId('screen-editor-save')).toBeDisabled()
    expect(
      (await configs(request, screenId)).song.mainText.constraints,
    ).toEqual(before.constraints)

    // Clicking it still selects it; unlocked, the same drag moves it.
    await expect(settings).toBeVisible()
    await page.getByTestId('screen-editor-lock-position').click()
    await drag(page, 'mainText', 120, 60)
    await save(page)
    const after = (await configs(request, screenId)).song.mainText
    expect(after.locked).toBe(false)
    expect(after.constraints.left.value).toBeGreaterThan(
      before.constraints.left.value,
    )
  })
})
