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
  WEBM_FIXTURE,
} from './helpers/background-media'

/**
 * A presentation's Slides item (T-183): a deck of our own slides. Each slide
 * is one step as it comes in, then one more per click of its animations, like
 * PowerPoint; Down plays the next click or brings the next slide in with its
 * transition, past the last slide into the next item; Up shows the step
 * before as it ended, without playing it. The preview and the screens draw
 * the deck the same way, scaled from its design size.
 */

/** Long enough to see an effect running, short enough to wait for. */
const EFFECT_MS = 1000

interface Media {
  image: string
  video: string
}

function deck(media: Media) {
  return {
    slides: [
      {
        id: 's1',
        kind: 'title_text',
        background: { type: 'color', color: '#102030' },
        elements: [
          {
            id: 'e-static',
            type: 'text',
            x: 160,
            y: 60,
            w: 1600,
            h: 200,
            html: '<p style="text-align: center">Titlu</p>',
            fontSize: 80,
          },
          {
            id: 'e-title',
            type: 'text',
            x: 960,
            y: 540,
            w: 480,
            h: 270,
            html: '<p>Bine ați venit</p>',
            animations: [
              {
                id: 'a-fade',
                kind: 'entrance',
                effect: 'fade',
                trigger: 'click',
                delayMs: 0,
                durationMs: EFFECT_MS,
              },
            ],
          },
          {
            id: 'e-picture',
            type: 'image',
            mediaId: media.image,
            x: 100,
            y: 300,
            w: 400,
            h: 300,
            animations: [
              {
                id: 'a-fly',
                kind: 'entrance',
                effect: 'fly',
                direction: 'left',
                trigger: 'with_previous',
                delayMs: 0,
                durationMs: EFFECT_MS,
              },
            ],
          },
        ],
      },
      {
        id: 's2',
        kind: 'video',
        transition: { effect: 'push', direction: 'right', durationMs: 600 },
        elements: [
          {
            id: 'e-video',
            type: 'video',
            mediaId: media.video,
            x: 0,
            y: 0,
            w: 1920,
            h: 1080,
            loop: true,
            muted: true,
          },
        ],
      },
    ],
  }
}

interface DeckState {
  type: string
  data: {
    itemId?: number
    slideIndex?: number
    buildIndex?: number
    slideCount?: number
    scheduleItemIndex?: number
  }
}

async function liveContent(request: APIRequestContext): Promise<DeckState> {
  const res = await request.get('/api/presentation/state')
  return (await res.json()).data.temporaryContent
}

/** The step on screen: `deck s.b`, or the content type with its step. */
async function liveStep(request: APIRequestContext): Promise<string> {
  const content = await liveContent(request)
  if (!content) return 'none'
  if (content.type !== 'deck_slide') {
    return `${content.type} @${content.data.scheduleItemIndex}`
  }
  return `deck ${content.data.slideIndex}.${content.data.buildIndex} @${content.data.scheduleItemIndex}`
}

async function createPresentation(request: APIRequestContext) {
  const res = await request.post('/api/schedules', {
    data: { title: `E2E Slides ${Date.now()}` },
  })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).data.id as number
}

async function addItem(
  request: APIRequestContext,
  scheduleId: number,
  data: Record<string, unknown>,
) {
  const res = await request.post(`/api/schedules/${scheduleId}/items`, { data })
  expect(res.status(), await res.text()).toBe(201)
  return (await res.json()).data as {
    id: number
    itemType: string
    itemConfig: ReturnType<typeof deck> & { width: number; height: number }
  }
}

async function uploadFixtures(request: APIRequestContext): Promise<Media> {
  const image = await uploadMedia(
    request,
    fs.readFileSync(JPEG_FIXTURE),
    'image/jpeg',
    'deck-picture.jpg',
  )
  const video = await uploadMedia(
    request,
    fs.readFileSync(WEBM_FIXTURE),
    'video/webm',
    'deck-video.webm',
  )
  return { image: image.id, video: video.id }
}

function element(scope: Locator, id: string): Locator {
  return scope.locator(`[data-testid="deck-element"][data-element-id="${id}"]`)
}

/** The element's animated body, as the screen shows it now. */
function shownStyle(scope: Locator, id: string) {
  return element(scope, id)
    .locator('[data-deck-target]')
    .evaluate((node) => {
      const style = getComputedStyle(node)
      return {
        visibility: style.visibility,
        opacity: style.opacity,
        running: node.getAnimations().length,
      }
    })
}

/**
 * The element as it stands for half a second, frame by frame: whether it was
 * ever animated or ever not fully shown.
 */
function watchShown(scope: Locator, id: string) {
  return element(scope, id)
    .locator('[data-deck-target]')
    .evaluate(
      (node) =>
        new Promise<{ animated: boolean; hidden: boolean }>((resolve) => {
          const seen = { animated: false, hidden: false }
          const until = performance.now() + 500
          const sample = () => {
            const style = getComputedStyle(node)
            if (node.getAnimations().length > 0) seen.animated = true
            if (style.visibility !== 'visible' || style.opacity !== '1') {
              seen.hidden = true
            }
            if (performance.now() < until) requestAnimationFrame(sample)
            else resolve(seen)
          }
          sample()
        }),
    )
}

async function expectShown(scope: Locator, id: string, shown: boolean) {
  await expect(element(scope, id)).toHaveAttribute(
    'data-visible',
    String(shown),
  )
  await expect
    .poll(() => shownStyle(scope, id), { timeout: 5000 })
    .toEqual(
      shown
        ? { visibility: 'visible', opacity: '1', running: 0 }
        : { visibility: 'hidden', opacity: '1', running: 0 },
    )
}

/** The 960,540 480×270 box sits at the same fraction of the slide box. */
async function expectTitlePlaced(scope: Locator) {
  const slide = await scope.getByTestId('deck-slide-box').boundingBox()
  const title = await element(scope, 'e-title').boundingBox()
  expect(slide && title).toBeTruthy()
  const near = (actual: number, expected: number) =>
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(2)
  near(title!.x, slide!.x + slide!.width / 2)
  near(title!.y, slide!.y + slide!.height / 2)
  near(title!.width, slide!.width / 4)
  near(title!.height, slide!.height / 4)
}

async function press(page: Page, key: 'ArrowDown' | 'ArrowUp') {
  await page.keyboard.press(key)
}

test.describe('Slides items', () => {
  let media: Media | undefined

  test.beforeAll(async ({ request }) => {
    media = await uploadFixtures(request)
  })

  test.afterAll(async ({ request }) => {
    if (!media) return
    await request.delete(`${MEDIA_API}/${media.image}`)
    await request.delete(`${MEDIA_API}/${media.video}`)
  })

  test.afterEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary')
  })

  test('a deck is checked and its text sanitized when saved', async ({
    request,
  }) => {
    const id = await createPresentation(request)

    const bad = await request.post(`/api/schedules/${id}/items`, {
      data: { slides: { slides: [{ id: 's', kind: 'nope', elements: [] }] } },
    })
    expect(bad.status()).toBe(400)
    expect((await bad.json()).error).toContain('slides[0].kind')

    const outside = await request.post(`/api/schedules/${id}/items`, {
      data: {
        slides: {
          slides: [
            {
              id: 's',
              kind: 'picture',
              elements: [
                {
                  id: 'p',
                  type: 'image',
                  mediaId: '../secret.jpg',
                  x: 0,
                  y: 0,
                  w: 1,
                  h: 1,
                },
              ],
            },
          ],
        },
      },
    })
    expect(outside.status()).toBe(400)

    const item = await addItem(request, id, {
      slides: {
        slides: [
          {
            id: 's',
            kind: 'title',
            elements: [
              {
                id: 't',
                type: 'text',
                x: 0,
                y: 0,
                w: 100,
                h: 100,
                html: '<p style="color: red; position: fixed" onclick="x()">Hi<script>alert(1)</script><img src=x onerror=y()></p>',
              },
            ],
          },
        ],
      },
    })
    expect(item.itemType).toBe('slides')
    expect(item.itemConfig.width).toBe(1920)
    expect(item.itemConfig.height).toBe(1080)
    const [slide] = item.itemConfig.slides
    expect((slide!.elements[0] as { html: string }).html).toBe(
      '<p style="color: red">Hi</p>',
    )

    // Its settings change the same way as any item's.
    const put = await request.put(
      `/api/schedules/${id}/items/${item.id}/config`,
      {
        data: {
          itemConfig: {
            slides: [
              { id: 'a', kind: 'blank', elements: [] },
              { id: 'b', kind: 'blank', elements: [] },
            ],
          },
        },
      },
    )
    expect(put.ok()).toBeTruthy()
    expect((await put.json()).data.itemConfig.slides).toHaveLength(2)
    const wrong = await request.put(
      `/api/schedules/${id}/items/${item.id}/config`,
      { data: { itemConfig: { slides: [{ id: 'a', kind: 'blank' }] } } },
    )
    expect(wrong.status()).toBe(400)
  })

  test('Down plays each click and brings each slide in; Up shows the step before', async ({
    page,
    request,
  }) => {
    const id = await createPresentation(request)
    const item = await addItem(request, id, { slides: deck(media!) })
    await addItem(request, id, {
      slideType: 'announcement',
      slideContent: '<p>După diapozitive</p>',
    })

    await page.goto(`/schedules/${id}`)
    const row = page
      .getByTestId('schedule-item')
      .filter({ hasText: 'Titlu Bine ați venit' })
    await row.getByText('Titlu Bine ați venit').first().click()
    // Its slides, one row each.
    await expect(page.getByTestId('schedule-sub-item-0')).toContainText('1')
    await expect(page.getByTestId('schedule-sub-item-2')).toContainText('2')

    const preview = page.getByTestId('live-preview')

    // Slide 1 comes in: what waits for a click is hidden.
    await press(page, 'ArrowDown')
    await expect.poll(() => liveStep(request)).toBe('deck 0.0 @0')
    expect((await liveContent(request)).data).toMatchObject({
      itemId: item.id,
      slideCount: 2,
    })
    await expectShown(preview, 'e-static', true)
    await expectShown(preview, 'e-title', false)
    await expectShown(preview, 'e-picture', false)
    await expectTitlePlaced(preview)

    // The click: the title fades in, the picture flies in with it.
    await press(page, 'ArrowDown')
    await expect.poll(() => liveStep(request)).toBe('deck 0.1 @1')
    await expect
      .poll(async () => (await shownStyle(preview, 'e-title')).running, {
        timeout: EFFECT_MS,
        intervals: [50],
      })
      .toBeGreaterThan(0)
    await expectShown(preview, 'e-title', true)
    await expectShown(preview, 'e-picture', true)

    // Slide 2 pushes slide 1 out, its video playing.
    await press(page, 'ArrowDown')
    await expect.poll(() => liveStep(request)).toBe('deck 1.0 @2')
    const video = preview.getByTestId('deck-video')
    await expect(video).toBeVisible()
    await expect(video).toHaveAttribute('src', new RegExp(media!.video))
    await expect(preview.getByTestId('deck-slide')).toHaveAttribute(
      'data-slide-index',
      '1',
    )

    // Up: slide 1 as its click left it, nothing playing.
    await press(page, 'ArrowUp')
    await expect.poll(() => liveStep(request)).toBe('deck 0.1 @1')
    await expect(preview.getByTestId('deck-slide')).toHaveAttribute(
      'data-slide-index',
      '0',
    )
    expect(await watchShown(preview, 'e-title')).toEqual({
      animated: false,
      hidden: false,
    })
    await expectShown(preview, 'e-picture', true)

    await press(page, 'ArrowUp')
    await expect.poll(() => liveStep(request)).toBe('deck 0.0 @0')
    await expectShown(preview, 'e-title', false)

    // Down to the end of the deck, then into the next item.
    await press(page, 'ArrowDown')
    await expect.poll(() => liveStep(request)).toBe('deck 0.1 @1')
    await press(page, 'ArrowDown')
    await expect.poll(() => liveStep(request)).toBe('deck 1.0 @2')
    await press(page, 'ArrowDown')
    await expect.poll(() => liveStep(request)).toBe('announcement @3')

    // A slide's row puts it up as it comes in.
    await row.getByText('Titlu Bine ați venit').first().click()
    await page.getByTestId('schedule-sub-item-2').click()
    await expect.poll(() => liveStep(request)).toBe('deck 1.0 @2')
  })

  test('a screen draws the deck as the preview does', async ({
    page,
    request,
  }) => {
    const created = await request.post('/api/screens', {
      data: { name: `E2E Slides screen ${Date.now()}`, type: 'primary' },
    })
    expect(created.ok()).toBeTruthy()
    const screenId = (await created.json()).data.id as number
    try {
      const id = await createPresentation(request)
      await addItem(request, id, { slides: deck(media!) })
      await page.goto(`/screen/${screenId}`)
      await expect(page.getByTestId('screen-renderer-root')).toBeVisible()

      const present = (step: number) =>
        request.post(`/api/schedules/${id}/steps/${step}/present`)
      expect((await present(0)).ok()).toBeTruthy()
      const screen = page.getByTestId('screen-renderer-root')
      await expect(screen.getByTestId('deck-slide')).toHaveAttribute(
        'data-build-index',
        '0',
      )
      await expectShown(screen, 'e-static', true)
      await expectShown(screen, 'e-title', false)
      await expectTitlePlaced(screen)

      expect((await present(1)).ok()).toBeTruthy()
      await expect(screen.getByTestId('deck-slide')).toHaveAttribute(
        'data-build-index',
        '1',
      )
      await expectShown(screen, 'e-title', true)
      await expectShown(screen, 'e-picture', true)
      await expectTitlePlaced(screen)
    } finally {
      await request.delete(`/api/screens/${screenId}`)
    }
  })
})
