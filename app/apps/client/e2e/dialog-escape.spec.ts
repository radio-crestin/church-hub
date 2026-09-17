import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * Escape on the song page goes back to the song list, or hides the projection
 * while a slide is up. Pressed inside a dialog it only closes that dialog: the
 * dialogs the side column opens (renaming the program, adding to it, editing a
 * marked song) must not also leave the page or blank the screen behind them.
 */

interface Fixture {
  song: { id: number; title: string }
  marked: { id: number; title: string }
  schedule: { id: number; title: string }
}

async function createSong(request: APIRequestContext, title: string) {
  const response = await request.post('/api/songs', {
    data: { title, slides: [{ content: `${title} lyrics`, sortOrder: 0 }] },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data as Fixture['song']
}

async function createFixture(request: APIRequestContext): Promise<Fixture> {
  const uniq = Date.now()
  const song = await createSong(request, `E2E Dialog Esc ${uniq}`)
  const marked = await createSong(request, `E2E Dialog Esc Marked ${uniq}`)
  const scheduleResponse = await request.post('/api/schedules', {
    data: { title: `E2E Dialog Esc Program ${uniq}` },
  })
  expect(scheduleResponse.ok()).toBeTruthy()
  const schedule = (await scheduleResponse.json()).data
  await request.post('/api/song-bookmarks', { data: { songId: marked.id } })
  return { song, marked, schedule }
}

async function removeFixture(request: APIRequestContext, fixture: Fixture) {
  const bookmarks = (await (await request.get('/api/song-bookmarks')).json())
    .data as Array<{ id: number; songId: number }>
  for (const bookmark of bookmarks) {
    if (bookmark.songId === fixture.marked.id) {
      await request.delete(`/api/song-bookmarks/${bookmark.id}`).catch(() => {})
    }
  }
  await request.delete(`/api/schedules/${fixture.schedule.id}`).catch(() => {})
  await request.delete(`/api/songs/${fixture.song.id}`).catch(() => {})
  await request.delete(`/api/songs/${fixture.marked.id}`).catch(() => {})
}

/** Opens the song page with Marcaje and Programe (on the program) expanded. */
async function openSongPage(page: Page, fixture: Fixture) {
  await page.addInitScript((scheduleId: number) => {
    window.localStorage.setItem('song-editor-layout', 'normal')
    window.localStorage.setItem('song-detail:bookmarks-open', 'true')
    window.localStorage.setItem('song-detail:schedules-open', 'true')
    window.localStorage.setItem(
      'songPage.selectedScheduleId',
      String(scheduleId),
    )
  }, fixture.schedule.id)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/songs/${fixture.song.id}`)
  await expect(
    page.getByTestId('schedule-songs-panel').getByTestId('schedule-rename'),
  ).toBeVisible({ timeout: 15000 })
}

async function isHidden(request: APIRequestContext) {
  const response = await request.get('/api/presentation/state')
  return (await response.json()).data.isHidden as boolean
}

test.describe('Escape inside a dialog on the song page', () => {
  let fixture: Fixture

  test.beforeEach(async ({ request }) => {
    fixture = await createFixture(request)
  })

  test.afterEach(async ({ request }) => {
    await request.post('/api/presentation/stop').catch(() => {})
    await removeFixture(request, fixture)
  })

  test('closes the program rename dialog and stays on the song', async ({
    page,
    request,
  }) => {
    await openSongPage(page, fixture)
    const songUrl = page.url()

    await page.getByTestId('schedule-rename').click()
    const modal = page.getByTestId('rename-schedule-modal')
    const input = modal.getByTestId('rename-schedule-input')
    await expect(input).toBeFocused()
    await input.fill(`${fixture.schedule.title} not saved`)

    await page.keyboard.press('Escape')

    await expect(modal).toBeHidden()
    expect(page.url()).toBe(songUrl)
    await expect(page.getByTestId('schedule-songs-panel')).toContainText(
      fixture.schedule.title,
    )
    const stored = await request.get(`/api/schedules/${fixture.schedule.id}`)
    expect((await stored.json()).data.title).toBe(fixture.schedule.title)
  })

  test('walks the add-item dialog back and closes it, and stays on the song', async ({
    page,
  }) => {
    await openSongPage(page, fixture)
    const songUrl = page.url()

    await page.getByTestId('schedule-add-item').click()
    const modal = page.getByTestId('add-schedule-item-modal')
    await expect(modal.getByTestId('add-schedule-item-song')).toBeVisible()

    // From the song search, Escape returns to the type menu first.
    await modal.getByTestId('add-schedule-item-song').click()
    await modal.getByTestId('song-picker-search').click()
    await page.keyboard.press('Escape')
    await expect(
      modal.getByTestId('add-schedule-item-verseteTineri'),
    ).toBeVisible()
    expect(page.url()).toBe(songUrl)

    await page.keyboard.press('Escape')
    await expect(modal).toBeHidden()
    expect(page.url()).toBe(songUrl)
  })

  test('closes the song editor opened from Marcaje and stays on the song', async ({
    page,
  }) => {
    await openSongPage(page, fixture)
    const songUrl = page.url()

    await page
      .getByTestId('bookmark-item')
      .filter({ hasText: fixture.marked.title })
      .getByTestId('bookmark-song-edit')
      .click()
    const modal = page.getByTestId('song-editor-modal')
    await expect(modal).toBeVisible({ timeout: 10000 })

    await page.keyboard.press('Escape')

    await expect(modal).toBeHidden()
    expect(page.url()).toBe(songUrl)
  })

  test('leaves the projection up while a dialog takes the Escape', async ({
    page,
    request,
  }) => {
    await request.post('/api/presentation/temporary-song', {
      data: { songId: fixture.song.id },
    })
    await openSongPage(page, fixture)
    expect(await isHidden(request)).toBe(false)

    await page.getByTestId('schedule-rename').click()
    const modal = page.getByTestId('rename-schedule-modal')
    await expect(modal.getByTestId('rename-schedule-input')).toBeFocused()

    const presentationCalls: string[] = []
    page.on('request', (sent) => {
      if (
        sent.method() === 'POST' &&
        sent.url().includes('/api/presentation')
      ) {
        presentationCalls.push(sent.url())
      }
    })
    await page.keyboard.press('Escape')
    await expect(modal).toBeHidden()
    expect(presentationCalls).toEqual([])
    expect(await isHidden(request)).toBe(false)

    // With the dialog gone, Escape is the page's again.
    await page.keyboard.press('Escape')
    await expect.poll(() => isHidden(request), { timeout: 10000 }).toBe(true)
  })

  test('without a dialog open, Escape still goes back to the song list', async ({
    page,
  }) => {
    await openSongPage(page, fixture)

    await page.keyboard.press('Escape')

    await expect(page).toHaveURL(/\/songs\/?(\?.*)?$/, { timeout: 10000 })
  })
})
