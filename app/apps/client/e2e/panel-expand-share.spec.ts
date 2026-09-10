import { expect, type Page, test } from '@playwright/test'

/**
 * Opening a section gives it the space the shut ones are not using.
 *
 * A panel used to come back at whatever height it happened to have when it was
 * last closed, so opening Marcaje with Programe already shut still left it
 * half the column and a band of nothing underneath. The rule is now about what
 * is open right now: shut rows keep their header, open rows share the rest —
 * so one open row fills the column and two split it.
 *
 * The same rule drives every column, so Marcaje and Programe behave alike.
 */

const KEYS = {
  bookmarks: 'songs-list:bookmarks-open',
  schedules: 'songs-list:schedules-open',
}

async function openSongsList(
  page: Page,
  open: { bookmarks: boolean; schedules: boolean },
) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(
    ({ keys, state }) => {
      if (window.sessionStorage.getItem('e2e-share-seeded')) return
      window.sessionStorage.setItem('e2e-share-seeded', '1')
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith('workspace.songs-list')) {
          window.localStorage.removeItem(key)
        }
      }
      window.localStorage.setItem(keys.bookmarks, String(state.bookmarks))
      window.localStorage.setItem(keys.schedules, String(state.schedules))
    },
    { keys: KEYS, state: open },
  )
  await page.goto('/songs')
  await expect(page.getByTestId('workspace-panel-bookmarks')).toBeVisible({
    timeout: 15000,
  })
}

async function panelHeight(page: Page, panelId: string): Promise<number> {
  const box = await page.getByTestId(`workspace-panel-${panelId}`).boundingBox()
  return box?.height ?? 0
}

/** Height of the column the two panels share. */
async function columnHeight(page: Page): Promise<number> {
  const boxes = await Promise.all(
    ['bookmarks', 'schedules'].map(async (id) =>
      page.getByTestId(`workspace-panel-${id}`).boundingBox(),
    ),
  )
  const tops = boxes.map((b) => b?.y ?? 0)
  const bottoms = boxes.map((b) => (b?.y ?? 0) + (b?.height ?? 0))
  return Math.max(...bottoms) - Math.min(...tops)
}

test.describe('Opening a section takes the free space', () => {
  test('Marcaje fills the column while Programe is shut', async ({ page }) => {
    await openSongsList(page, { bookmarks: false, schedules: false })

    await page.getByTestId('bookmarks-collapse-toggle').click()

    const column = await columnHeight(page)
    await expect
      .poll(async () => await panelHeight(page, 'bookmarks'), { timeout: 5000 })
      .toBeGreaterThan(column * 0.7)

    // Programe is shut, not gone: its header is still there to open it by.
    expect(await panelHeight(page, 'schedules')).toBeLessThan(90)
    await expect(page.getByTestId('schedule-collapse-toggle')).toBeVisible()
  })

  test('the two split the column once both are open', async ({ page }) => {
    await openSongsList(page, { bookmarks: false, schedules: false })

    await page.getByTestId('bookmarks-collapse-toggle').click()
    await page.getByTestId('schedule-collapse-toggle').click()

    const column = await columnHeight(page)
    await expect
      .poll(async () => await panelHeight(page, 'schedules'), { timeout: 5000 })
      .toBeGreaterThan(column * 0.3)

    const bookmarks = await panelHeight(page, 'bookmarks')
    const schedules = await panelHeight(page, 'schedules')
    // Neither is squeezed: they are within a slice of each other.
    expect(Math.abs(bookmarks - schedules)).toBeLessThan(column * 0.15)
  })

  test('Programe fills the column while Marcaje is shut', async ({ page }) => {
    // The rule is one component's, so it holds whichever section is opened.
    await openSongsList(page, { bookmarks: false, schedules: false })

    await page.getByTestId('schedule-collapse-toggle').click()

    const column = await columnHeight(page)
    await expect
      .poll(async () => await panelHeight(page, 'schedules'), { timeout: 5000 })
      .toBeGreaterThan(column * 0.7)
    expect(await panelHeight(page, 'bookmarks')).toBeLessThan(90)
    await expect(page.getByTestId('bookmarks-collapse-toggle')).toBeVisible()
  })
})
