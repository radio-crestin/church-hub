import {
  type APIRequestContext,
  expect,
  type Locator,
  test,
} from '@playwright/test'

/**
 * T-076 — on the Game cântări page (/song-key), saving a song's gama must
 * keep the list where it was: no jump back to the top, and the edited row
 * stays in view showing its new gama.
 */

const SONG_COUNT = 40

async function createPresentedSongs(
  request: APIRequestContext,
  uniq: string,
  ids: number[],
) {
  for (let i = 0; i < SONG_COUNT; i++) {
    const title = `E2E Scroll ${uniq} ${String(i).padStart(2, '0')}`
    const created = await request.post('/api/songs', {
      data: { title, slides: [{ content: title, sortOrder: 0 }] },
    })
    const { data } = await created.json()
    ids.push(data.id)
    // Only presented songs are listed on the page.
    await request.post('/api/songs', {
      data: { id: data.id, title, presentationCount: 1 },
    })
  }
}

/**
 * The list loads 30 songs at a time, last presented first. Songs the earlier
 * specs really presented come before ours, so scroll down, as a user would,
 * until the row has loaded.
 */
async function scrollUntilLoaded(list: Locator, row: Locator) {
  await expect(async () => {
    await list.evaluate((el) => el.scrollTo(0, el.scrollHeight))
    await expect(row).toBeAttached({ timeout: 1000 })
  }).toPass({ timeout: 15000 })
}

test.describe('Game cântări keeps the scroll after saving a gama', () => {
  const ids: number[] = []

  // In afterEach, not a `finally`: it still runs, with a live `request`,
  // when the test times out, so no song is left behind to crowd other specs.
  test.afterEach(async ({ request }) => {
    for (const id of ids.splice(0)) await request.delete(`/api/songs/${id}`)
  })

  test('the list stays put and the edited row stays in view', async ({
    page,
    request,
  }) => {
    const uniq = `${Date.now()}`
    await createPresentedSongs(request, uniq, ids)

    await page.setViewportSize({ width: 1200, height: 700 })
    await page.goto('/song-key')
    const list = page.getByTestId('song-key-list')
    const row = page
      .getByTestId('song-key-row')
      .filter({ hasText: `E2E Scroll ${uniq} 25` })
    await scrollUntilLoaded(list, row)
    await expect(row).toBeVisible()
    // Let the list settle, then scroll the row to the middle of the list.
    await row.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    const scrollBefore = await list.evaluate((el) => el.scrollTop)
    expect(scrollBefore).toBeGreaterThan(300)

    await row.click()
    const input = page.locator('dialog[open]').getByTestId('key-line-input')
    await expect(input).toBeVisible()
    await input.fill(`Sol ${uniq}`)
    await page.locator('dialog[open]').getByTestId('key-line-save').click()
    await expect(input).toBeHidden()

    await expect(row).toContainText(`Sol ${uniq}`, { timeout: 10000 })
    await expect(row).toBeInViewport()
    const scrollAfter = await list.evaluate((el) => el.scrollTop)
    expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThan(50)
  })
})
