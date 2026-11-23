import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * The songs pages on a phone (CH-045): a tab bar at the bottom, the song's
 * preview pinned on top while the verses scroll under it, previous / hide /
 * next under the thumb, Marcaje / Programe / Versiuni as tabs, and what is
 * live reachable from any page.
 */

const PHONE = { width: 390, height: 844 }

const VERSES = [1, 2, 3, 4].map(
  (n) =>
    `<p>Strofa ${n} rândul unu</p><p>rândul doi</p><p>rândul trei</p><p>rândul patru</p><p>rândul cinci</p><p>rândul șase</p>`,
)

async function createSong(request: APIRequestContext, title: string) {
  const response = await request.post('/api/songs', {
    data: {
      title,
      slides: VERSES.map((content, sortOrder) => ({ content, sortOrder })),
    },
  })
  expect(response.status()).toBe(201)
  return ((await response.json()).data as { id: number }).id
}

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

test.describe('Songs on a phone', () => {
  let songId: number
  const title = `E2E Mobil ${Date.now()}`

  test.beforeEach(async ({ request }) => {
    songId = await createSong(request, title)
  })

  test.afterEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary').catch(() => {})
    await request.delete(`/api/songs/${songId}`).catch(() => {})
  })

  test('the tab bar leads to every page, and only on a phone', async ({
    page,
  }) => {
    await onPhone(page)
    await page.goto('/songs?fromSong=true')
    const tabs = page.getByTestId('mobile-tab-bar')
    await expect(tabs).toBeInViewport()
    for (const id of ['songs', 'bible', 'schedules', 'present', 'more']) {
      await expect(page.getByTestId(`mobile-tab-${id}`)).toBeVisible()
    }
    await expect(page.getByTestId('mobile-tab-songs')).toHaveAttribute(
      'aria-current',
      'page',
    )

    await page.getByTestId('mobile-tab-bible').click()
    await expect(page).toHaveURL(/\/bible/)

    // "Mai mult" opens the full menu, with the pages that have no tab.
    await page.getByTestId('mobile-tab-more').click()
    await expect
      .poll(
        async () => (await page.getByTestId('main-sidebar').boundingBox())?.x,
      )
      .toBe(0)

    await page.setViewportSize({ width: 1400, height: 900 })
    await expect(tabs).toBeHidden()
  })

  test('the preview stays in view while a lower verse is shown', async ({
    page,
    request,
  }) => {
    await onPhone(page)
    await page.goto(`/songs/${songId}`)
    const stage = page.getByTestId('song-phone-stage')
    await expect(stage).toBeVisible()
    // The song page has its own controls in place of the tab bar.
    await expect(page.getByTestId('song-phone-controls')).toBeInViewport()
    await expect(page.getByTestId('mobile-tab-bar')).toBeHidden()

    const lastVerse = page.getByText('Strofa 4 rândul unu')
    await lastVerse.scrollIntoViewIfNeeded()
    await lastVerse.click()
    await expect.poll(() => presentedSlideIndex(request)).toBe(3)

    // Scrolled down to verse 4, the preview is still on screen, shrunk.
    await expect(page.getByTestId('workspace-pinned')).toHaveAttribute(
      'data-stuck',
      'true',
    )
    await expect(stage).toBeInViewport()
    await expect(stage).toContainText('Strofa 4 rândul unu')

    await page.getByTestId('song-phone-prev').click()
    await expect.poll(() => presentedSlideIndex(request)).toBe(2)
    await page.getByTestId('song-phone-next').click()
    await expect.poll(() => presentedSlideIndex(request)).toBe(3)
    await page.getByTestId('song-phone-hide').click()
    await expect.poll(() => presentedSlideIndex(request)).toBeNull()
  })

  test('Marcaje, Programe and Versiuni are tabs on the song page', async ({
    page,
    request,
  }) => {
    const marked = await request.post('/api/song-bookmarks', {
      data: { songId },
    })
    const bookmarkId = (await marked.json()).data.id as number
    await onPhone(page)
    await page.goto(`/songs/${songId}`)
    await expect(page.getByTestId('workspace-panel-slides')).toBeVisible()

    await page.getByTestId('workspace-tab-bookmarks').click()
    const bookmarks = page.getByTestId('workspace-panel-bookmarks')
    await expect(bookmarks.getByText(title)).toBeVisible()
    await expect(page.getByTestId('workspace-panel-slides')).toBeHidden()

    await page.getByTestId('workspace-tab-schedules').click()
    await expect(page.getByTestId('workspace-panel-schedules')).toBeVisible()
    await page.getByTestId('workspace-tab-versions').click()
    await expect(page.getByTestId('workspace-panel-versions')).toBeVisible()

    // The songs list has Marcaje and Programe as tabs too.
    await page.goto('/songs?fromSong=true')
    await page.getByTestId('workspace-tab-bookmarks').click()
    await expect(
      page.getByTestId('workspace-panel-bookmarks').getByText(title),
    ).toBeVisible()
    await request.delete(`/api/song-bookmarks/${bookmarkId}`)
  })

  test('what is live can be moved on and hidden from another page', async ({
    page,
    request,
  }) => {
    await request.post('/api/presentation/temporary-song', {
      data: { songId, slideIndex: 0 },
    })
    await onPhone(page)
    // A page with no controls of its own (the Bible has its own bar).
    await page.goto('/schedules')
    const strip = page.getByTestId('mobile-live-strip')
    await expect(strip).toBeInViewport()
    await expect(strip.getByText(title)).toBeVisible()

    await page.getByTestId('mobile-live-strip-next').click()
    await expect.poll(() => presentedSlideIndex(request)).toBe(1)
    await page.getByTestId('mobile-live-strip-hide').click()
    await expect.poll(() => presentedSlideIndex(request)).toBeNull()
    await expect(strip).toBeHidden()
  })
})
