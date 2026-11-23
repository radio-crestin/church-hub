import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * The control room on a phone (CH-048): previous, hide and next under the
 * thumb above the tab bar (a phone has no arrow keys), the preview at the
 * top instead of floating in an empty box, and the livestream page in
 * proper Romanian.
 */

const PHONE = { width: 390, height: 844 }

const VERSES = [1, 2, 3].map(
  (n) => `<p>Strofa ${n} rândul unu</p><p>rândul doi</p>`,
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

test.describe('The control room on a phone', () => {
  test.describe.configure({ mode: 'serial' })

  let songId: number

  test.beforeEach(async ({ request }) => {
    const song = await request.post('/api/songs', {
      data: {
        title: `E2E Camera de control ${Date.now()}`,
        slides: VERSES.map((content, sortOrder) => ({ content, sortOrder })),
      },
    })
    songId = (await song.json()).data.id
    await request.post('/api/presentation/temporary-song', {
      data: { songId, slideIndex: 0 },
    })
  })

  test.afterEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary').catch(() => {})
    await request.delete(`/api/songs/${songId}`).catch(() => {})
  })

  test('what is live is moved on and hidden from the bottom bar', async ({
    page,
    request,
  }) => {
    await onPhone(page)
    await page.goto('/present')
    const bar = page.getByTestId('control-room-phone-controls')
    await expect(bar).toBeInViewport()
    // Live is one of the tab bar's pages: the tab bar stays under the bar.
    await expect(page.getByTestId('mobile-tab-bar')).toBeInViewport()

    // The preview sits right under the header, not in the middle of the page.
    const preview = await page.getByTestId('control-room-live').boundingBox()
    expect(preview?.y ?? 1000).toBeLessThan(200)

    await page.getByTestId('control-room-phone-next').click()
    await expect.poll(() => presentedSlideIndex(request)).toBe(1)
    await page.getByTestId('control-room-phone-next').click()
    await expect.poll(() => presentedSlideIndex(request)).toBe(2)
    await page.getByTestId('control-room-phone-prev').click()
    await expect.poll(() => presentedSlideIndex(request)).toBe(1)
    await page.getByTestId('control-room-phone-hide').click()
    await expect.poll(() => presentedSlideIndex(request)).toBeNull()
    await expect(page.getByTestId('control-room-live')).toHaveAttribute(
      'data-live',
      'false',
    )
  })

  test('a desktop keeps its header button and has no phone bar', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.addInitScript(() => {
      window.localStorage.setItem('church-hub-language', 'ro')
    })
    await page.goto('/present')
    await expect(page.getByRole('button', { name: /Ascunde/ })).toBeVisible()
    await expect(page.getByTestId('control-room-phone-controls')).toHaveCount(0)
  })

  test('the livestream page speaks proper Romanian', async ({ page }) => {
    await onPhone(page)
    await page.goto('/livestream')
    await expect(
      page.getByRole('button', { name: 'Pornește live-ul' }),
    ).toBeVisible()
  })

  test('the livestream settings fold under one row on a phone', async ({
    page,
  }) => {
    await onPhone(page)
    await page.goto('/livestream')
    const toggle = page.getByTestId('livestream-settings-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('livestream-obs-settings')).toHaveCount(0)

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await page.getByTestId('livestream-obs-settings').click()
    await expect(page).toHaveURL(/\/livestream\/obs$/)
  })

  test('the livestream settings stay open on a desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/livestream')
    await expect(page.getByTestId('livestream-obs-settings')).toBeVisible()
    await expect(page.getByTestId('livestream-settings-toggle')).toHaveCount(0)
  })
})
