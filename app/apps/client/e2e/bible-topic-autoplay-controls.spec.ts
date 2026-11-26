import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * A Bible topic played as a slideshow, from its header: Play, Loop, the
 * reading speed and the theme are icon buttons with their names in
 * tooltips; the speed changes how long the verse on screen stays up, at
 * once; and the live verse shows a ring that fills until the next one.
 */

const READING_SPEED = 'bible_reading_speed'

async function setReadingSpeed(request: APIRequestContext, wpm: number) {
  const saved = await request.post('/api/settings/app_settings', {
    data: { key: READING_SPEED, value: String(wpm) },
  })
  expect(saved.ok()).toBe(true)
}

/** The verse slideshow's timer on the server, or null. */
async function verseTimer(request: APIRequestContext) {
  return (await (await request.get('/api/presentation/verse-loop')).json())
    .data as { entryIndex: number; durationMs: number } | null
}

/** The place in the list of the verse slideshow on screen, or null. */
async function slideshowIndex(request: APIRequestContext) {
  const state = (await (await request.get('/api/presentation/state')).json())
    .data
  const content = state.temporaryContent
  if (state.isHidden || content?.type !== 'versete_tineri') return null
  return content.data.currentEntryIndex as number
}

async function openGodsLove(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('church-hub-language', 'ro')
    window.localStorage.setItem('bible:topics-open', 'true')
  })
  await page.goto('/bible')
  const panel = page.getByTestId('bible-topics-panel')
  await panel.getByTestId('bible-topic-gods-love').click()
  await expect(panel.getByTestId('bible-topic-passage').first()).toBeVisible()
  return panel
}

test.describe('Bible topic autoplay controls', () => {
  // One global presentation state per server.
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary')
  })

  test.afterEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary')
    await request.delete(`/api/settings/app_settings/${READING_SPEED}`)
  })

  test('Play, Loop, speed and theme are icon buttons named in tooltips; Play and Loop toggle', async ({
    page,
    request,
  }) => {
    await setReadingSpeed(request, 6000)
    const panel = await openGodsLove(page)
    const play = panel.getByTestId('bible-topic-play')
    const loop = panel.getByTestId('bible-topic-loop')
    const speed = panel.getByTestId('bible-topic-speed')
    const theme = panel.getByTestId('bible-topic-template')

    for (const button of [play, loop, speed, theme]) {
      await expect(button).toHaveText('')
      await expect(button).toHaveAttribute('aria-label', /\S/)
    }
    await expect(play).toHaveAttribute('aria-label', 'Prezintă automat')
    await expect(loop).toHaveAttribute('aria-label', 'În buclă')
    await expect(theme).toHaveAttribute('aria-label', /^Tema: /)

    await play.hover()
    await expect(page.getByRole('tooltip')).toHaveText('Prezintă automat')
    await theme.hover()
    await expect(page.getByRole('tooltip')).toHaveText(/^Tema: /)

    await expect(play).toHaveAttribute('aria-pressed', 'false')
    await play.click()
    await expect(play).toHaveAttribute('aria-pressed', 'true')
    await expect(loop).toHaveAttribute('aria-pressed', 'false')
    await expect.poll(() => slideshowIndex(request)).not.toBeNull()

    // Loop takes over from Play, then stops when pressed again.
    await loop.click()
    await expect(loop).toHaveAttribute('aria-pressed', 'true')
    await expect(play).toHaveAttribute('aria-pressed', 'false')
    await loop.click()
    await expect(loop).toHaveAttribute('aria-pressed', 'false')
    await expect.poll(() => slideshowIndex(request)).toBeNull()
  })

  test('the speed control changes how long the verse on screen stays up', async ({
    page,
    request,
  }) => {
    // At 40 words a minute John 3:16 stays up for over half a minute.
    await setReadingSpeed(request, 40)
    const panel = await openGodsLove(page)
    await panel.getByTestId('bible-topic-play').click()
    await expect
      .poll(async () => (await verseTimer(request))?.durationMs ?? 0)
      .toBeGreaterThan(30_000)
    const slow = (await verseTimer(request))!.durationMs

    await panel.getByTestId('bible-topic-speed').click()
    const value = page.getByTestId('bible-topic-speed-value')
    await expect(value).toHaveText('40 de cuvinte pe minut')
    await page.getByTestId('bible-topic-speed-slider').fill('400')
    await expect(value).toHaveText('400 de cuvinte pe minut')

    // Ten times faster: the verse on screen is rescaled and moves on soon.
    await expect
      .poll(async () => (await verseTimer(request))?.durationMs ?? slow)
      .toBeLessThan(slow / 5)
    await expect
      .poll(() => slideshowIndex(request), { timeout: 10_000 })
      .toBe(1)
    const saved = (
      await (
        await request.get(`/api/settings/app_settings/${READING_SPEED}`)
      ).json()
    ).data
    expect(saved.value).toBe('400')

    // The arrows move the slider, not the slideshow; Escape closes it and
    // leaves the verse on screen.
    await page.keyboard.press('ArrowLeft')
    await expect(value).toHaveText('390 de cuvinte pe minut')
    expect(await slideshowIndex(request)).toBeGreaterThanOrEqual(1)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('bible-topic-speed-popover')).toHaveCount(0)
    expect(await slideshowIndex(request)).not.toBeNull()
  })

  test('the live verse shows a ring filling over its reading time, reset on each advance', async ({
    page,
    request,
  }) => {
    await setReadingSpeed(request, 300)
    const panel = await openGodsLove(page)
    const passages = panel.getByTestId('bible-topic-passage')
    const ring = panel.getByTestId('bible-topic-progress')

    // Presented by hand, nothing counts down.
    await passages.first().getByRole('button').first().click()
    await expect(passages.first()).toHaveAttribute('data-active', 'true')
    await expect(ring).toHaveCount(0)

    await panel.getByTestId('bible-topic-play').click()
    await expect(
      passages.first().getByTestId('bible-topic-progress'),
    ).toBeVisible()
    const progress = async () =>
      Number(await ring.getAttribute('data-progress'))
    const early = await progress()
    await expect.poll(progress).toBeGreaterThan(early + 10)

    // The next verse goes up as the ring closes, and its ring starts over.
    await expect(
      passages.nth(1).getByTestId('bible-topic-progress'),
    ).toBeVisible({ timeout: 10_000 })
    await expect(ring).toHaveCount(1)
    expect(await progress()).toBeLessThan(50)

    // Next by hand restarts the count on the verse it presents.
    await panel.getByTestId('bible-topic-next').click()
    await expect(
      passages.nth(2).getByTestId('bible-topic-progress'),
    ).toBeVisible()
    expect(await progress()).toBeLessThan(50)

    await panel.getByTestId('bible-topic-play').click()
    await expect.poll(() => slideshowIndex(request)).toBeNull()
    await expect(ring).toHaveCount(0)
  })
})
