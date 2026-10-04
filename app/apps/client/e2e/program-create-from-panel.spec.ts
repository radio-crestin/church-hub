import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * A program can be made from the Programe panel, and "Today" makes the one
 * named after today's date in a single click (T-024).
 */

interface ScheduleRow {
  id: number
  title: string
}

/** Today as the app names programs: "04.10.2026". */
function todayTitle(): string {
  const now = new Date()
  const day = String(now.getDate()).padStart(2, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${day}.${month}.${now.getFullYear()}`
}

async function programsTitled(
  request: APIRequestContext,
  title: string,
): Promise<ScheduleRow[]> {
  const res = await request.get('/api/schedules')
  const { data } = await res.json()
  return (data as ScheduleRow[]).filter((row) => row.title === title)
}

async function deleteProgramsTitled(
  request: APIRequestContext,
  title: string,
): Promise<void> {
  for (const row of await programsTitled(request, title)) {
    await request.delete(`/api/schedules/${row.id}`).catch(() => {})
  }
}

async function createSong(request: APIRequestContext, title: string) {
  const res = await request.post('/api/songs', {
    data: { title, slides: [{ content: `${title} slide`, sortOrder: 0 }] },
  })
  return (await res.json()).data.id as number
}

async function openSongPageWithPanel(page: Page, songId: number) {
  await page.addInitScript(() => {
    window.localStorage.setItem('song-detail:schedules-open', 'true')
  })
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto(`/songs/${songId}`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByTestId('schedule-songs-panel')).toBeVisible({
    timeout: 10000,
  })
}

/** The program the panel has picked, as it remembers it. */
async function expectPanelOn(
  page: Page,
  request: APIRequestContext,
  title: string,
) {
  const [program] = await programsTitled(request, title)
  expect(program).toBeTruthy()
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem('songPage.selectedScheduleId'),
      ),
    )
    .toBe(String(program.id))
}

/** The panel's "New program", whether it sits in the header or under "More". */
async function clickNewProgram(page: Page) {
  const inline = page.getByTestId('schedule-new')
  if (await inline.isVisible()) {
    await inline.click()
    return
  }
  await page.getByTestId('schedule-header-more').click()
  await page.getByTestId('schedule-new-menu').click()
}

test.describe('create a program from the Programe panel', () => {
  let songId: number
  const today = todayTitle()

  test.beforeEach(async ({ request }) => {
    songId = await createSong(request, `E2E Today Song ${Date.now()}`)
    await deleteProgramsTitled(request, today)
  })

  test.afterEach(async ({ request }) => {
    await deleteProgramsTitled(request, today)
    await request.delete(`/api/songs/${songId}`).catch(() => {})
  })

  test('a named program is created and picked in the panel', async ({
    page,
    request,
  }) => {
    const title = `E2E Panel Program ${Date.now()}`
    try {
      await openSongPageWithPanel(page, songId)
      await clickNewProgram(page)
      const modal = page.getByTestId('create-schedule-modal')
      await expect(modal).toBeVisible()
      await modal.getByTestId('create-schedule-input').fill(title)
      await modal.getByTestId('create-schedule-save').click()
      await expect(modal).toBeHidden()

      await expect
        .poll(async () => (await programsTitled(request, title)).length)
        .toBe(1)
      await expectPanelOn(page, request, title)
    } finally {
      await deleteProgramsTitled(request, title)
    }
  })

  test('"Today" makes today\'s program in one click, and reuses it the second time', async ({
    page,
    request,
  }) => {
    await openSongPageWithPanel(page, songId)
    const modal = page.getByTestId('create-schedule-modal')

    for (let press = 0; press < 2; press++) {
      await clickNewProgram(page)
      await expect(modal).toBeVisible()
      await modal.getByTestId('create-schedule-today').click()
      await expect(modal).toBeHidden()
    }

    await expect
      .poll(async () => (await programsTitled(request, today)).length)
      .toBe(1)
    await expectPanelOn(page, request, today)
  })

  test('"Today" in the Add to program dialog creates today\'s program and adds the song', async ({
    page,
    request,
  }) => {
    await openSongPageWithPanel(page, songId)
    await page.getByTestId('song-add-to-schedule').click()
    const modal = page.getByTestId('add-song-to-schedule-modal')
    await expect(modal).toBeVisible({ timeout: 10000 })
    await modal.getByTestId('add-song-to-schedule-today').click()
    await expect(modal).toBeHidden()

    await expect
      .poll(async () => {
        const [program] = await programsTitled(request, today)
        if (!program) return []
        const res = await request.get(`/api/schedules/${program.id}`)
        const { data } = await res.json()
        return data.items.map((item: { songId: number | null }) => item.songId)
      })
      .toEqual([songId])
  })
})
