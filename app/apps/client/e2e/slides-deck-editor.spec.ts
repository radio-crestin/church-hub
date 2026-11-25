import fs from 'node:fs'
import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test'

import {
  JPEG_FIXTURE,
  MEDIA_API,
  uploadMedia,
} from './helpers/background-media'

/**
 * The Slides item's editor (T-183): a PowerPoint-like page with the slides on
 * the left, the slide on the canvas and Design, Transition and Animations
 * beside it. Everything done there is saved by itself, can be undone, and is
 * what the presentation then plays.
 */

interface DeckElement {
  id: string
  type: string
  x: number
  y: number
  w: number
  h: number
  html?: string
  mediaId?: string
  animations?: { effect: string; kind: string; trigger: string }[]
}

interface DeckSlide {
  id: string
  kind: string
  transition?: { effect: string }
  elements: DeckElement[]
}

interface Deck {
  slides: DeckSlide[]
}

async function createDeck(request: APIRequestContext) {
  const schedule = await request.post('/api/schedules', {
    data: { title: `E2E Slides editor ${Date.now()}` },
  })
  expect(schedule.ok()).toBeTruthy()
  const scheduleId = (await schedule.json()).data.id as number
  const item = await request.post(`/api/schedules/${scheduleId}/items`, {
    data: {
      slides: {
        slides: [
          {
            id: 'first',
            kind: 'title',
            elements: [
              {
                id: 'title',
                type: 'text',
                x: 160,
                y: 390,
                w: 1600,
                h: 300,
                html: '<p style="text-align: center">Bun venit</p>',
                fontSize: 88,
              },
            ],
          },
        ],
      },
    },
  })
  expect(item.status(), await item.text()).toBe(201)
  return { scheduleId, itemId: (await item.json()).data.id as number }
}

async function savedDeck(
  request: APIRequestContext,
  scheduleId: number,
): Promise<Deck> {
  const res = await request.get(`/api/schedules/${scheduleId}`)
  const items = (await res.json()).data.items as {
    itemType: string
    itemConfig: Deck
  }[]
  return items.find((i) => i.itemType === 'slides')!.itemConfig
}

/** Waits until the editor says everything is saved. */
async function expectSaved(page: Page) {
  await expect(page.getByTestId('deck-editor-status')).toHaveAttribute(
    'data-status',
    'saved',
    { timeout: 10_000 },
  )
}

/** Screen pixels per design pixel on the canvas. */
async function canvasScale(page: Page): Promise<number> {
  const box = await page.getByTestId('deck-editor-canvas').boundingBox()
  return box!.width / 1920
}

async function drag(
  page: Page,
  target: Locator,
  dx: number,
  dy: number,
  modifier?: 'Alt',
) {
  const box = (await target.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  if (modifier) await page.keyboard.down(modifier)
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 5 })
  await page.mouse.move(x + dx, y + dy, { steps: 5 })
  await page.mouse.up()
  if (modifier) await page.keyboard.up(modifier)
}

async function liveStep(request: APIRequestContext): Promise<string> {
  const res = await request.get('/api/presentation/state')
  const content = (await res.json()).data.temporaryContent
  if (!content) return 'none'
  return content.type === 'deck_slide'
    ? `deck ${content.data.slideIndex}.${content.data.buildIndex}`
    : content.type
}

test.describe('Slides editor', () => {
  let imageId: string | undefined

  test.beforeAll(async ({ request }) => {
    const image = await uploadMedia(
      request,
      fs.readFileSync(JPEG_FIXTURE),
      'image/jpeg',
      'deck-editor-picture.jpg',
    )
    imageId = image.id
  })

  test.afterAll(async ({ request }) => {
    if (imageId) await request.delete(`${MEDIA_API}/${imageId}`)
  })

  test.afterEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary')
  })

  test('builds a slide, saves it by itself, undoes, and the presentation plays it', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    const { scheduleId, itemId } = await createDeck(request)

    // Edit, from the presentation's list.
    await page.goto(`/schedules/${scheduleId}`)
    await page
      .getByTestId('schedule-item')
      .filter({ hasText: 'Bun venit' })
      .getByText('Bun venit')
      .first()
      .click()
    await page.getByTestId('deck-slide-edit-0').click()
    await expect(page).toHaveURL(
      new RegExp(`/schedules/${scheduleId}/slides/${itemId}`),
    )
    await expect(page.getByTestId('deck-editor')).toBeVisible()
    const slides = page.getByTestId('deck-editor-slide')
    await expect(slides).toHaveCount(1)

    // A new blank slide, opened.
    await page.getByTestId('deck-editor-add-slide').click()
    await page.getByTestId('deck-editor-add-slide-blank').click()
    await expect(slides).toHaveCount(2)
    await expect(slides.nth(1)).toHaveAttribute('data-selected', 'true')

    // A text box, its text typed in place.
    await page.getByTestId('deck-editor-insert').click()
    await page.getByTestId('deck-editor-insert-text').click()
    const box = page.locator(
      '[data-testid="deck-editor-element"][data-selected]',
    )
    await expect(box).toHaveCount(1)
    await box.dblclick()
    const input = page.getByTestId('deck-editor-text-input')
    await expect(input).toBeFocused()
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type('Salut')
    await page.keyboard.press('Escape')
    await expect(input).toHaveCount(0)
    const newText = async () =>
      (await savedDeck(request, scheduleId)).slides[1]?.elements[0]
    await expect.poll(async () => (await newText())?.html).toContain('Salut')
    const text = (await newText())!

    // Moved by a drag (Alt: no snapping), then resized by its corner. The
    // saved box is checked once it has landed (saving waits a moment).
    const scale = await canvasScale(page)
    const near = (actual: number | undefined, expected: number) =>
      Math.abs((actual ?? Number.NaN) - expected) <= 2
    await box.click()
    await drag(page, box, 120, 60, 'Alt')
    await expect
      .poll(async () => {
        const e = await newText()
        return (
          near(e?.x, text.x + 120 / scale) && near(e?.y, text.y + 60 / scale)
        )
      })
      .toBe(true)
    const moved = (await newText())!
    await drag(page, page.getByTestId('deck-editor-handle-se'), 80, 40)
    await expect
      .poll(async () => {
        const e = await newText()
        return (
          near(e?.w, moved.w + 80 / scale) &&
          near(e?.h, moved.h + 40 / scale) &&
          e?.x === moved.x
        )
      })
      .toBe(true)
    const resized = (await newText())!

    // A picture from the gallery.
    await page.getByTestId('deck-editor-insert').click()
    await page.getByTestId('deck-editor-insert-image').click()
    const dialog = page.getByTestId('deck-editor-media-dialog')
    await dialog
      .locator(
        `[data-testid="background-media-item"][data-media-id="${imageId}"]`,
      )
      .getByRole('button')
      .first()
      .click()
    await expect(dialog).toBeHidden()
    await expect(page.getByTestId('deck-editor-element')).toHaveCount(2)

    // The text fades in on a click; the slide pushes in. (The picture lies
    // over the text box's left part: it is picked by its right end.)
    const textBox = page.locator(
      `[data-testid="deck-editor-element"][data-element-id="${text.id}"]`,
    )
    const textBounds = (await textBox.boundingBox())!
    await textBox.click({
      position: { x: textBounds.width - 15, y: 10 },
    })
    await expect(textBox).toHaveAttribute('data-selected', 'true')
    await page.getByTestId('deck-editor-tab-animations').click()
    await page.getByTestId('deck-editor-add-animation').click()
    await expect(page.getByTestId('deck-editor-animation')).toHaveCount(1)
    await page.getByTestId('deck-editor-tab-transition').click()
    await page.getByTestId('deck-editor-transition-effect').selectOption('push')
    await expectSaved(page)

    // The new slide dragged before the first one, then that undone.
    await drag(page, slides.nth(1), 0, -200)
    await expect
      .poll(async () => (await savedDeck(request, scheduleId)).slides[0]!.id)
      .not.toBe('first')
    await page.getByTestId('deck-editor-undo').click()
    await expectSaved(page)
    await expect
      .poll(async () => (await savedDeck(request, scheduleId)).slides[0]!.id)
      .toBe('first')

    // Everything is there after a reload.
    await page.reload()
    await expect(slides).toHaveCount(2)
    const deck = await savedDeck(request, scheduleId)
    const [first, second] = deck.slides
    expect(first!.id).toBe('first')
    expect(second!.transition?.effect).toBe('push')
    const saved = second!.elements.find((e) => e.id === text.id)!
    expect(saved.html).toContain('Salut')
    expect(saved.x).toBe(resized.x)
    expect(saved.w).toBe(resized.w)
    expect(saved.animations).toEqual([
      expect.objectContaining({
        kind: 'entrance',
        effect: 'fade',
        trigger: 'click',
      }),
    ])
    expect(second!.elements.find((e) => e.type === 'image')?.mediaId).toBe(
      imageId,
    )

    // The presentation plays it: the title, the new slide, then its click.
    await page.getByTestId('deck-editor-back').click()
    await expect(page).toHaveURL(new RegExp(`/schedules/${scheduleId}$`))
    await page
      .getByTestId('schedule-item')
      .filter({ hasText: 'Bun venit' })
      .getByText('Bun venit')
      .first()
      .click()
    // Each press once the page shows the step before it (its next press
    // moves on from what the page knows is up).
    const preview = page.getByTestId('live-preview')
    for (const [slide, build] of [
      [0, 0],
      [1, 0],
      [1, 1],
    ]) {
      await page.keyboard.press('ArrowDown')
      await expect.poll(() => liveStep(request)).toBe(`deck ${slide}.${build}`)
      await expect(preview.getByTestId('deck-slide')).toHaveAttribute(
        'data-build-index',
        String(build),
      )
      await expect(preview.getByTestId('deck-slide')).toHaveAttribute(
        'data-slide-index',
        String(slide),
      )
    }
    await expect(
      preview.locator(
        `[data-testid="deck-element"][data-element-id="${text.id}"]`,
      ),
    ).toHaveAttribute('data-visible', 'true')
  })

  test('on a phone: the slides across the top, an element picked and moved', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const { scheduleId, itemId } = await createDeck(request)
    await page.goto(`/schedules/${scheduleId}/slides/${itemId}`)
    await expect(page.getByTestId('deck-editor')).toBeVisible()

    // The strip runs across, above the canvas; the panel sits under it.
    const strip = (await page.getByTestId('deck-editor-slides').boundingBox())!
    const canvas = (await page.getByTestId('deck-editor-canvas').boundingBox())!
    const panel = (await page.getByTestId('deck-editor-panel').boundingBox())!
    expect(strip.y + strip.height).toBeLessThanOrEqual(canvas.y + 1)
    expect(panel.y).toBeGreaterThanOrEqual(canvas.y + canvas.height - 1)
    expect(canvas.width).toBeGreaterThan(300)

    const title = page.locator(
      '[data-testid="deck-editor-element"][data-element-id="title"]',
    )
    await title.click()
    await expect(title).toHaveAttribute('data-selected', 'true')
    const scale = await canvasScale(page)
    await drag(page, title, 30, 20, 'Alt')
    await expect
      .poll(async () => {
        const e = (await savedDeck(request, scheduleId)).slides[0]!.elements[0]!
        return (
          Math.abs(e.x - (160 + 30 / scale)) <= 2 &&
          Math.abs(e.y - (390 + 20 / scale)) <= 2
        )
      })
      .toBe(true)
  })

  test('a deck saved while its slide is on screen shows the change at once', async ({
    request,
  }) => {
    const { scheduleId, itemId } = await createDeck(request)
    const present = await request.post(
      `/api/schedules/${scheduleId}/steps/0/present`,
    )
    expect(present.ok()).toBeTruthy()
    const deck = await savedDeck(request, scheduleId)
    const edited = structuredClone(deck) as Deck
    edited.slides[0]!.elements[0]!.html = '<p>Bine ați venit</p>'
    const put = await request.put(
      `/api/schedules/${scheduleId}/items/${itemId}/config`,
      { data: { itemConfig: edited } },
    )
    expect(put.ok()).toBeTruthy()
    const state = (await (await request.get('/api/presentation/state')).json())
      .data.temporaryContent
    expect(state.type).toBe('deck_slide')
    expect(state.data.slide.elements[0].html).toBe('<p>Bine ați venit</p>')
  })
})
