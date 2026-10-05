import {
  type APIRequestContext,
  expect,
  type Page,
  type TestInfo,
  test,
} from '@playwright/test'

/**
 * T-096: clicking a song said "the song doesn't exist" while the song was
 * there. The song page took every failure to load for a missing song:
 * - the computer losing internet: the API is our own server, yet the query
 *   library paused every request and the page saw "no song";
 * - a request that failed or timed out.
 * Only a song the server really doesn't have may say so (and lead back to the
 * list); any other failure keeps the page with a "Try again" button.
 */

const NOT_FOUND_TOAST =
  /Song not found|Cântarea nu a fost găsită|no longer exists|nu mai există/i

async function createSong(request: APIRequestContext, label: string) {
  const title = `T096 ${label} ${Date.now()}`
  const lyric = `Lyric line for ${title}`
  const res = await request.post('/api/songs', {
    data: { title, slides: [{ content: lyric, sortOrder: 0, label: 'V1' }] },
  })
  expect(res.ok()).toBe(true)
  const { id } = (await res.json()).data as { id: number }
  return { id, title, lyric }
}

const notFoundToast = (page: Page) => page.getByText(NOT_FOUND_TOAST).first()

/** The song page's first verse: only there once the song itself is open. */
const songSlide = (page: Page, lyric: string) =>
  page.getByTestId('song-slide-0').filter({ hasText: lyric })

/** A screenshot per step, kept with the run's output (for the demo video). */
async function snap(page: Page, testInfo: TestInfo, name: string) {
  await page.waitForTimeout(700) // let a toast finish sliding in
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`) })
}

test.describe('Opening a song (T-096)', () => {
  test('opens while the computer reports no internet', async ({
    page,
    request,
  }, testInfo) => {
    const song = await createSong(request, 'offline')
    await page.goto(`/songs?q=${encodeURIComponent(song.title)}`)
    const row = page.locator('h3', { hasText: song.title }).first()
    await expect(row).toBeVisible({ timeout: 15000 })

    // What the webview does when Wi-Fi drops: the local server still answers.
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))
    await snap(page, testInfo, '1-list-offline')
    await row.click()

    const lyric = songSlide(page, song.lyric)
    await expect(lyric.or(notFoundToast(page))).toBeVisible({ timeout: 10000 })
    await snap(page, testInfo, '2-after-click')
    await expect(lyric).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/songs/${song.id}`))
    await expect(notFoundToast(page)).toHaveCount(0)
  })

  test('a failed load offers a retry instead of "not found"', async ({
    page,
    request,
  }, testInfo) => {
    const song = await createSong(request, 'retry')
    const songApi = `**/api/songs/${song.id}`
    await page.route(songApi, (route) => route.abort('failed'))

    await page.goto(`/songs/${song.id}`)
    const loadError = page.getByTestId('song-load-error')
    await expect(loadError.or(notFoundToast(page))).toBeVisible({
      timeout: 20000,
    })
    await snap(page, testInfo, '3-load-failed')
    await expect(loadError).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/songs/${song.id}`))
    await expect(notFoundToast(page)).toHaveCount(0)

    await page.unroute(songApi)
    await page.getByTestId('song-load-retry').click()
    await expect(songSlide(page, song.lyric)).toBeVisible({ timeout: 10000 })
    await snap(page, testInfo, '4-retried')
  })

  test('a deleted song says so and leads back to the list', async ({
    page,
    request,
  }, testInfo) => {
    const song = await createSong(request, 'deleted')
    expect((await request.delete(`/api/songs/${song.id}`)).ok()).toBe(true)

    await page.goto(`/songs/${song.id}`)
    await expect(notFoundToast(page)).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL(/\/songs\/?(\?|$)/)
    await snap(page, testInfo, '5-deleted')
  })
})
