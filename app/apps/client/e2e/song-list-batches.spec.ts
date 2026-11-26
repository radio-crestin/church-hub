import { expect, type Page, test } from '@playwright/test'

/**
 * The song list loads 50 songs, then the next 50 each time the reader scrolls
 * near the end (CH-050). On a phone the whole page scrolls, not the list's own
 * box: the list used to take every row for on screen and load page after page
 * by itself (1,400 of 26,462 songs within seconds, over the phone's tunnel).
 */

const PAGE_SIZE = 50
const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1920, height: 1080 }

/** Offsets of the browse list's page requests (`/api/songs?limit=50&…`). */
function trackPageOffsets(page: Page) {
  const offsets = new Set<number>()
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname !== '/api/songs') return
    if (url.searchParams.get('limit') !== String(PAGE_SIZE)) return
    offsets.add(Number(url.searchParams.get('offset')))
  })
  return offsets
}

/** Scrolls the list down, as the reader does, until `count` songs show. */
async function scrollUntilShowing(page: Page, count: number) {
  const showing = page.getByText(new RegExp(`afișate: ${count} din`))
  await expect(async () => {
    await page.locator('[data-index]').last().scrollIntoViewIfNeeded()
    await expect(showing).toBeVisible({ timeout: 500 })
  }).toPass({ timeout: 20_000 })
}

test.describe('Song list batches', () => {
  const created: number[] = []

  test.beforeAll(async ({ request }) => {
    // Enough songs for three pages, whatever the suite left behind.
    const { data } = await (await request.get('/api/songs?limit=1')).json()
    const stamp = Date.now()
    for (let n = data.total; n < PAGE_SIZE * 3 + 5; n++) {
      const res = await request.post('/api/songs', {
        data: {
          title: `E2E Batch ${stamp} ${n}`,
          slides: [{ content: '<p>Strofa</p>', sortOrder: 0 }],
        },
      })
      created.push(((await res.json()).data as { id: number }).id)
    }
  })

  test.afterAll(async ({ request }) => {
    for (const id of created) await request.delete(`/api/songs/${id}`)
  })

  for (const [device, viewport] of [
    ['a phone', PHONE],
    ['a computer', DESKTOP],
  ] as const) {
    test(`on ${device} the list shows 50 songs, then the next 50 as it scrolls`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await page.addInitScript(() => {
        localStorage.setItem('church-hub-language', 'ro')
        localStorage.setItem('songList.sortBy', '')
      })
      const offsets = trackPageOffsets(page)
      const showing = page.getByText(/^Cântări afișate: \d+ din \d+/)

      await page.goto('/songs')
      await expect(showing).toContainText(`afișate: ${PAGE_SIZE} din`)
      // Nothing scrolled: no other page comes by itself.
      await page.waitForTimeout(2_000)
      expect([...offsets]).toEqual([0])
      await expect(showing).toContainText(`afișate: ${PAGE_SIZE} din`)

      await scrollUntilShowing(page, PAGE_SIZE * 2)
      expect([...offsets]).toEqual([0, PAGE_SIZE])

      await scrollUntilShowing(page, PAGE_SIZE * 3)
      expect([...offsets]).toEqual([0, PAGE_SIZE, PAGE_SIZE * 2])
    })
  }

  test('on a phone the A–Z list draws only the rows on screen, its rail in reach', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE)
    await page.addInitScript(() => {
      localStorage.setItem('church-hub-language', 'ro')
      localStorage.setItem('songList.sortBy', 'title')
    })
    await page.goto('/songs')
    const rail = page.getByTestId('alphabet-index')
    await expect(rail).toBeInViewport()
    await expect(page.locator('[data-index]').first()).toBeVisible()
    expect(await page.locator('[data-index]').count()).toBeLessThan(60)

    await page.getByTestId('alphabet-letter-M').click()
    await expect(page.getByTestId('song-section-M')).toBeInViewport()
    await expect(rail).toBeInViewport()
    expect(await page.locator('[data-index]').count()).toBeLessThan(60)
  })
})
