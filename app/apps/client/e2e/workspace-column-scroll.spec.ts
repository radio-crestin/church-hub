import { expect, type Page, test } from '@playwright/test'

/**
 * Marcaje / Programe / Versiuni share one column, and they used to share it
 * badly: the rows split the column as percentages, so a short window squeezed
 * all three until none of them showed anything, and expanding a panel back to
 * a remembered 95% drove its neighbours under their minimum — the group
 * answers that by collapsing them to nothing, header and all, with no way back
 * except hunting for an 8px divider.
 *
 * Two rules hold that shut: the column never squeezes its rows below the room
 * they need (it scrolls instead), and a panel coming back from collapsed only
 * reclaims what it can while leaving its neighbours on screen.
 */

const HEIGHTS_KEY = 'workspace.song-detail.heights'

/** Height of a panel as it is actually laid out, or 0 when it has none. */
async function panelHeight(page: Page, panelId: string): Promise<number> {
  const box = await page.getByTestId(`workspace-panel-${panelId}`).boundingBox()
  return box?.height ?? 0
}

/** Seeds the per-device preferences these tests depend on. */
async function seedPreferences(
  page: Page,
  options: { bookmarksOpen: boolean; rememberedBookmarksHeight?: number },
) {
  await page.addInitScript(
    ({ heightsKey, bookmarksOpen, rememberedBookmarksHeight }) => {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith('workspace.song-detail')) {
          window.localStorage.removeItem(key)
        }
      }
      if (rememberedBookmarksHeight !== undefined) {
        window.localStorage.setItem(
          heightsKey,
          JSON.stringify({ bookmarks: rememberedBookmarksHeight }),
        )
      }
      window.localStorage.setItem(
        'song-detail:bookmarks-open',
        String(bookmarksOpen),
      )
      window.localStorage.setItem('song-detail:schedules-open', 'true')
      window.localStorage.setItem('song-detail:versions-open', 'true')
      window.localStorage.setItem('song-editor-layout', 'normal')
    },
    {
      heightsKey: HEIGHTS_KEY,
      bookmarksOpen: options.bookmarksOpen,
      rememberedBookmarksHeight: options.rememberedBookmarksHeight,
    },
  )
}

test.describe.configure({ mode: 'serial' })

test.describe('Side-panel column stays reachable', () => {
  let songId: number
  let otherSongId: number

  test.beforeAll(async ({ request }) => {
    const create = async (title: string) => {
      const response = await request.post('/api/songs', {
        data: { title, slides: [{ content: 'First slide', sortOrder: 0 }] },
      })
      expect(response.status()).toBe(201)
      return (await response.json()).data.id as number
    }
    songId = await create(`E2E Column Scroll A ${Date.now()}`)
    otherSongId = await create(`E2E Column Scroll B ${Date.now()}`)
  })

  test.afterAll(async ({ request }) => {
    await request.delete(`/api/songs/${songId}`)
    await request.delete(`/api/songs/${otherSongId}`)
  })

  test('a window too short for three panels scrolls instead of squeezing them', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 420 })
    await seedPreferences(page, { bookmarksOpen: true })
    await page.goto(`/songs/${songId}`)
    await expect(page.getByTestId('workspace-panel-bookmarks')).toBeVisible({
      timeout: 15000,
    })

    const column = page.getByTestId('workspace-column-col-3')
    const overflow = await column.evaluate((element) => ({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    }))
    expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight)

    // Every panel keeps at least its header plus a usable body — none of them
    // is compressed out of existence to make the others fit.
    for (const panelId of ['bookmarks', 'schedules', 'versions']) {
      expect(await panelHeight(page, panelId)).toBeGreaterThanOrEqual(100)
    }

    // And the last one is genuinely reachable by scrolling the column.
    await column.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expect(page.getByTestId('workspace-panel-versions')).toBeInViewport()
  })

  test('expanding a panel remembered at almost full height keeps its neighbours', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await seedPreferences(page, {
      bookmarksOpen: false,
      rememberedBookmarksHeight: 95,
    })
    await page.goto(`/songs/${songId}`)
    await expect(page.getByTestId('workspace-panel-schedules')).toBeVisible({
      timeout: 15000,
    })

    await page.getByTestId('bookmarks-collapse-toggle').click()

    // Marcaje takes most of the column, but not so much that Programe and
    // Versiuni lose their headers.
    await expect
      .poll(async () => await panelHeight(page, 'bookmarks'), { timeout: 5000 })
      .toBeGreaterThan(200)
    expect(await panelHeight(page, 'schedules')).toBeGreaterThanOrEqual(40)
    expect(await panelHeight(page, 'versions')).toBeGreaterThanOrEqual(40)
    await expect(page.getByTestId('schedule-collapse-toggle')).toBeInViewport()
  })

  test('which sections are open is a preference, not a per-song state', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await seedPreferences(page, { bookmarksOpen: true })
    await page.goto(`/songs/${songId}`)
    await expect(page.getByTestId('workspace-panel-schedules')).toBeVisible({
      timeout: 15000,
    })

    // Shut Programe on this song.
    await page.getByTestId('schedule-collapse-toggle').click()
    await expect
      .poll(async () => await panelHeight(page, 'schedules'), { timeout: 5000 })
      .toBeLessThan(90)

    // Walking to another song must not reopen it: the operator set this up
    // once, and it holds for every song they visit next.
    await page.goto(`/songs/${otherSongId}`)
    await expect(page.getByTestId('workspace-panel-schedules')).toBeVisible({
      timeout: 15000,
    })
    expect(await panelHeight(page, 'schedules')).toBeLessThan(90)
    // The two that were left open are still open.
    expect(await panelHeight(page, 'bookmarks')).toBeGreaterThan(100)
    expect(await panelHeight(page, 'versions')).toBeGreaterThan(100)
  })
})
