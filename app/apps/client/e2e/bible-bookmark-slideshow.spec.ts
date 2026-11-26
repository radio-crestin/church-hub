import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { openActionsMenu } from './helpers/actions-menu'

/**
 * The Marcaje slideshow (T-082): ▶ shows the bookmarked verses one after
 * another, the arrows step through them rather than through the chapter, and
 * 🔁 plays them in a loop on its own, each verse for its reading time.
 *
 * Serial, because every test here writes to the one global bookmark list and
 * the one screen.
 */
test.describe('Bible bookmark slideshow', () => {
  test.describe.configure({ mode: 'serial' })

  const READING_SPEED = 'bible_reading_speed'

  async function setBookmarks(request: APIRequestContext, text: string) {
    await request.delete('/api/bible-bookmarks')
    const imported = await request.post('/api/bible-bookmarks/import', {
      data: { text, translationId: 1 },
    })
    expect(imported.ok()).toBe(true)
  }

  /** What the screen shows: the reading's reference, or null when hidden. */
  async function onScreen(request: APIRequestContext) {
    const response = await request.get('/api/presentation/state')
    const { data } = await response.json()
    const content = data?.temporaryContent
    if (data?.isHidden || content?.type !== 'versete_tineri') return null
    return content.data.entries[content.data.currentEntryIndex]
      .reference as string
  }

  async function openBible(page: Page, rows: number) {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('bible:bookmarks-open', 'true')
    })
    await page.goto('/bible')
    await expect(page.getByTestId('bible-bookmark-item')).toHaveCount(rows, {
      timeout: 15000,
    })
  }

  test.beforeEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary')
  })

  test.afterAll(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary')
    await request.delete('/api/bible-bookmarks')
    await request.delete(`/api/settings/app_settings/${READING_SPEED}`)
  })

  test('▶ shows the chosen verses in order and the arrows step through them', async ({
    page,
    request,
  }) => {
    await setBookmarks(request, 'Ioan 3:16\nRomani 5:8\nPsalmi 23:1')
    await openBible(page, 3)

    const play = page.getByTestId('bible-bookmarks-play')
    const position = page.getByTestId('bible-bookmarks-play-position')
    await play.click()

    await expect.poll(() => onScreen(request)).toMatch(/^Ioan 3:16/)
    await expect(position).toHaveText('1/3')

    // The next verse is the next bookmark, from another book — not Ioan 3:17.
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => onScreen(request)).toMatch(/^Romani 5:8/)
    await expect(position).toHaveText('2/3')
    await expect(
      page.getByTestId('bible-bookmark-item').nth(1),
    ).toHaveAttribute('data-live', 'true')

    await page.keyboard.press('ArrowLeft')
    await expect.poll(() => onScreen(request)).toMatch(/^Ioan 3:16/)

    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => onScreen(request)).toMatch(/^Psalmii? 23:1/)
    await expect(position).toHaveText('3/3')

    // Past the last one the screen clears, as at the end of a program.
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => onScreen(request)).toBeNull()
    await expect(position).toBeHidden()
  })

  test('■ stops the slideshow', async ({ page, request }) => {
    await setBookmarks(request, 'Ioan 3:16\nRomani 5:8')
    await openBible(page, 2)

    const play = page.getByTestId('bible-bookmarks-play')
    await play.click()
    await expect.poll(() => onScreen(request)).toMatch(/^Ioan 3:16/)

    await play.click()
    await expect.poll(() => onScreen(request)).toBeNull()
  })

  test('🔁 moves on by itself after each reading time and starts over', async ({
    page,
    request,
  }) => {
    // Fast readers: every verse here gets the 3 s floor.
    const saved = await request.post('/api/settings/app_settings', {
      data: { key: READING_SPEED, value: '600' },
    })
    expect(saved.ok()).toBe(true)
    await setBookmarks(request, 'Ioan 3:16\nRomani 5:8')
    await openBible(page, 2)

    const loop = page.getByTestId('bible-bookmarks-loop')
    await loop.click()
    await expect(loop).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => onScreen(request)).toMatch(/^Ioan 3:16/)

    // No key pressed: the server moves on, then wraps to the first verse.
    await expect
      .poll(() => onScreen(request), { timeout: 8000 })
      .toMatch(/^Romani 5:8/)
    await expect
      .poll(() => onScreen(request), { timeout: 8000 })
      .toMatch(/^Ioan 3:16/)

    // Pressing it again stops the loop and clears the screen.
    await loop.click()
    await expect.poll(() => onScreen(request)).toBeNull()
    await expect(loop).toHaveAttribute('aria-pressed', 'false')

    // And nothing comes back on its own afterwards.
    await page.waitForTimeout(4000)
    expect(await onScreen(request)).toBeNull()
  })

  test('▶ and 🔁 are icon buttons; while 🔁 plays, the bookmark on screen shows a filling ring', async ({
    page,
    request,
  }) => {
    const saved = await request.post('/api/settings/app_settings', {
      data: { key: READING_SPEED, value: '600' },
    })
    expect(saved.ok()).toBe(true)
    await setBookmarks(request, 'Ioan 3:16\nRomani 5:8')
    await openBible(page, 2)

    const play = page.getByTestId('bible-bookmarks-play')
    const loop = page.getByTestId('bible-bookmarks-loop')
    for (const button of [play, loop]) {
      await expect(button).toHaveText('')
      await expect(button).toHaveAttribute('aria-pressed', 'false')
    }
    await loop.hover()
    await expect(page.getByRole('tooltip')).toHaveText(/\S/)

    const rows = page.getByTestId('bible-bookmark-item')
    const ring = page.getByTestId('bible-bookmark-progress')
    // Stepped by hand, nothing counts down.
    await play.click()
    await expect(play).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => onScreen(request)).toMatch(/^Ioan 3:16/)
    await expect(ring).toHaveCount(0)

    // 🔁 takes over from the verse on screen, and its ring follows it.
    await loop.click()
    await expect(loop).toHaveAttribute('aria-pressed', 'true')
    await expect(play).toHaveAttribute('aria-pressed', 'false')
    await expect(
      rows.first().getByTestId('bible-bookmark-progress'),
    ).toBeVisible()
    // The bookmark on screen is the live row, as in the other lists.
    await expect(rows.first()).toHaveAttribute('data-live', 'true')
    await expect(rows.nth(1)).not.toHaveAttribute('data-live', 'true')
    await expect(
      rows.nth(1).getByTestId('bible-bookmark-progress'),
    ).toBeVisible({ timeout: 8000 })
    await expect(ring).toHaveCount(1)
    await expect(rows.nth(1)).toHaveAttribute('data-live', 'true')
    await expect(rows.nth(1)).toHaveClass(/ring-live/)

    await loop.click()
    await expect.poll(() => onScreen(request)).toBeNull()
    await expect(ring).toHaveCount(0)
    await expect(rows.nth(1)).not.toHaveAttribute('data-live', 'true')
    await request.delete(`/api/settings/app_settings/${READING_SPEED}`)
  })

  test('the seldom-used actions wait under "More"', async ({
    page,
    request,
  }) => {
    await setBookmarks(request, 'Ioan 3:16')
    await openBible(page, 1)

    const panel = page.getByTestId('bible-bookmarks-panel')
    await expect(panel.getByTestId('bible-bookmarks-play')).toBeVisible()
    await expect(panel.getByTestId('bible-bookmarks-loop')).toBeVisible()

    const menu = await openActionsMenu(page, 'bible-bookmarks-header-more')
    for (const action of ['add-note', 'import', 'export', 'clear']) {
      await expect(
        menu.getByTestId(`bible-bookmarks-${action}-menu`),
      ).toBeVisible()
    }
  })

  test('the reading speed is set in the Bible settings', async ({
    page,
    request,
  }) => {
    await page.goto('/settings/bible')
    const input = page.getByTestId('bible-reading-speed')
    await input.fill('220')
    await input.blur()

    await expect
      .poll(async () => {
        const response = await request.get(
          `/api/settings/app_settings/${READING_SPEED}`,
        )
        return (await response.json()).data?.value
      })
      .toBe('220')
  })
})
