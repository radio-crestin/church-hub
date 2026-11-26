import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * A program on a phone (CH-047): the preview pinned on top while the program
 * scrolls, previous / hide / next under the thumb, the program's whole name
 * in the header with loading, saving and deleting in its menu, and song
 * titles readable in the list.
 */

const PHONE = { width: 390, height: 844 }
const SONG_TITLE = 'Cântare de laudă pentru dimineața de duminică E2E'

const VERSES = [1, 2, 3, 4].map(
  (n) =>
    `<p>Strofa ${n} rândul unu</p><p>rândul doi</p><p>rândul trei</p><p>rândul patru</p><p>rândul cinci</p><p>rândul șase</p>`,
)

async function onPhone(page: Page) {
  await page.setViewportSize(PHONE)
  await page.addInitScript(() => {
    window.localStorage.setItem('church-hub-language', 'ro')
  })
}

async function presentedSlideIndex(request: APIRequestContext) {
  const state = (await (await request.get('/api/presentation/state')).json())
    .data
  return state.isHidden ? null : state.temporaryContent?.data?.currentSlideIndex
}

test.describe('A program on a phone', () => {
  test.describe.configure({ mode: 'serial' })

  let songId: number
  let scheduleId: number
  const programTitle = `Duminică dimineața, serviciul de închinare ${Date.now()}`

  test.beforeEach(async ({ request }) => {
    const song = await request.post('/api/songs', {
      data: {
        title: `${SONG_TITLE} ${Date.now()}`,
        slides: VERSES.map((content, sortOrder) => ({ content, sortOrder })),
      },
    })
    expect(song.status()).toBe(201)
    songId = (await song.json()).data.id
    const schedule = await request.post('/api/schedules', {
      data: {
        title: programTitle,
        date: new Date().toISOString().slice(0, 10),
      },
    })
    scheduleId = (await schedule.json()).data.id
    await request.post(`/api/schedules/${scheduleId}/items`, {
      data: { songId },
    })
    await request.post(`/api/schedules/${scheduleId}/items`, {
      data: { slideType: 'announcement', slideContent: 'Anunț E2E' },
    })
  })

  test.afterEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary').catch(() => {})
    await request.delete(`/api/schedules/${scheduleId}`).catch(() => {})
    await request.delete(`/api/songs/${songId}`).catch(() => {})
  })

  test('the preview stays pinned and the program is walked from the bottom bar', async ({
    page,
    request,
  }) => {
    await onPhone(page)
    await page.goto(`/schedules/${scheduleId}`)
    await expect(page.getByTestId('schedule-phone-controls')).toBeInViewport()
    // A program is opened from the list: its bar takes the tab bar's place.
    await expect(page.getByTestId('mobile-tab-bar')).toBeHidden()

    const item = page.getByTestId('schedule-item').first()
    await item.getByText(SONG_TITLE).click()
    await item.getByText('Strofa 1 rândul unu').click()
    await expect.poll(() => presentedSlideIndex(request)).toBe(0)

    // Scrolled down to the last verse, the preview is still on screen.
    const lastVerse = item.getByText('Strofa 4 rândul unu')
    await lastVerse.scrollIntoViewIfNeeded()
    await expect(page.getByTestId('workspace-pinned')).toHaveAttribute(
      'data-stuck',
      'true',
    )
    const stage = page.getByTestId('schedule-phone-stage')
    await expect(stage).toBeInViewport()
    await expect(stage).toContainText('Strofa 1 rândul unu')

    await page.getByTestId('schedule-phone-next').click()
    await expect.poll(() => presentedSlideIndex(request)).toBe(1)
    await page.getByTestId('schedule-phone-prev').click()
    await expect.poll(() => presentedSlideIndex(request)).toBe(0)
    await page.getByTestId('schedule-phone-hide').click()
    await expect.poll(() => presentedSlideIndex(request)).toBeNull()
  })

  test("the header shows the presentation's whole name; Run, file and delete actions are in the menu", async ({
    page,
  }) => {
    await onPhone(page)
    await page.goto(`/schedules/${scheduleId}`)
    const title = page.getByTestId('schedule-title-edit')
    await expect(title).toBeVisible()
    // The name wraps no further than the room it has, and is not cut off by
    // a row of buttons: only the menu sits beside it.
    const titleBox = await title.boundingBox()
    expect(titleBox?.width ?? 0).toBeGreaterThan(250)

    await expect(page.getByTestId('schedule-run-button')).toHaveCount(0)
    await page.getByTestId('schedule-presenter-actions-menu').click()
    await expect(page.getByTestId('schedule-run-action')).toBeVisible()
    await expect(
      page.getByTestId('schedule-load-from-file-action'),
    ).toBeVisible()
    await expect(page.getByTestId('schedule-save-to-file-action')).toBeVisible()
    await page.getByTestId('schedule-delete-action').click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('a long song title is readable in the program, and its key is set from the row menu', async ({
    page,
  }) => {
    await onPhone(page)
    await page.goto(`/schedules/${scheduleId}`)
    const item = page.getByTestId('schedule-item').first()
    const title = item.getByText(SONG_TITLE)
    await expect(title).toBeVisible()
    // On two lines rather than cut short after a few letters.
    expect(
      await title.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true)
    await expect(item.getByTestId('schedule-item-key-line')).toBeHidden()

    await item.getByTestId('schedule-item-options').click()
    await expect(page.getByRole('button', { name: /gama|key/i })).toBeVisible()
  })

  test('a desktop keeps its columns and its file actions, with no phone bar', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto(`/schedules/${scheduleId}`)
    await expect(page.getByTestId('workspace-panel-preview')).toBeVisible()
    await expect(page.getByTestId('schedule-phone-controls')).toHaveCount(0)
    await expect(page.getByTestId('schedule-run-button')).toBeVisible()
    // Saving to a file lives in the program's menu on every screen size.
    await page.getByTestId('schedule-presenter-actions-menu').click()
    await expect(page.getByTestId('schedule-save-to-file-action')).toBeVisible()
    await expect(page.getByTestId('schedule-run-action')).toHaveCount(0)
  })
})
