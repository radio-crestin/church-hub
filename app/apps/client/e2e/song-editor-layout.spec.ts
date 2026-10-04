import { expect, type Page, test } from '@playwright/test'

/**
 * The song editor (opened from the song page's top-right corner):
 *  - no Programe panel, the slide rail sits on the right of the form,
 *  - the title row stays fixed at the top while the page scrolls,
 *  - "Editează ca text" switches the Slides section to text in place.
 */

const SLIDE_COUNT = 14

async function createLongSong(
  request: import('@playwright/test').APIRequestContext,
) {
  const slides = Array.from({ length: SLIDE_COUNT }, (_, i) => ({
    content: `<p>Strofa ${i + 1} linia unu</p><p>Strofa ${i + 1} linia doi</p>`,
    sortOrder: i,
  }))
  const response = await request.post('/api/songs', {
    data: { title: `E2E Editor Layout ${Date.now()}`, slides },
  })
  expect(response.status()).toBe(201)
  const { data } = await response.json()
  return data as { id: number; title: string }
}

async function openEditor(page: Page, songId: number) {
  await page.addInitScript(() => {
    window.localStorage.setItem('sidebar-collapsed', 'true')
    window.localStorage.setItem('church-hub-language', 'ro')
  })
  await page.goto(`/songs/${songId}/edit`)
  await expect(page.getByTestId('song-editor-title')).toBeVisible()
}

test.describe('Song editor layout', () => {
  test('has no Programe panel and puts the slide rail right of the form', async ({
    page,
    request,
  }) => {
    const song = await createLongSong(request)
    try {
      await page.setViewportSize({ width: 1600, height: 900 })
      await openEditor(page, song.id)

      // The Programe panel used to be a second aside; only the rail is left.
      await expect(page.locator('main aside')).toHaveCount(1)
      await expect(
        page.locator('main').getByText('Programe', { exact: true }),
      ).toHaveCount(0)

      const rail = page.getByTestId('song-editor-slide-rail')
      await expect(rail).toBeVisible()
      const railBox = await rail.boundingBox()
      const formBox = await page
        .getByRole('button', { name: 'Editează ca text' })
        .boundingBox()
      expect(railBox).not.toBeNull()
      expect(formBox).not.toBeNull()
      if (!railBox || !formBox) return
      expect(railBox.x).toBeGreaterThan(formBox.x + formBox.width)
      expect(railBox.x + railBox.width).toBeLessThanOrEqual(1600)
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('keeps the title row fixed while scrolling', async ({
    page,
    request,
  }) => {
    const song = await createLongSong(request)
    try {
      await page.setViewportSize({ width: 1600, height: 700 })
      await openEditor(page, song.id)

      await page.mouse.move(700, 400)
      await page.mouse.wheel(0, 2000)
      await page.waitForTimeout(400)

      const title = page.getByTestId('song-editor-title')
      await expect(title).toBeInViewport()
      const box = await title.boundingBox()
      expect(box).not.toBeNull()
      expect(box?.y ?? 999).toBeLessThan(80)
      await expect(page.getByTestId('song-editor-save')).toBeInViewport()
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('edits the slides as text in place, without a dialog', async ({
    page,
    request,
  }) => {
    const song = await createLongSong(request)
    try {
      await page.setViewportSize({ width: 1600, height: 900 })
      await openEditor(page, song.id)

      const toggle = page.getByTestId('song-slides-toggle-text-mode')
      await toggle.click()

      await expect(page.locator('dialog[open]')).toHaveCount(0)
      const input = page.getByTestId('song-slides-text-input')
      await expect(input).toBeVisible()
      await expect(input).toContainText('Strofa 1 linia unu')

      const current = await input.inputValue()
      await input.fill(`${current}\n\n---\n\nStrofa noua`)
      await expect(
        page.getByRole('heading', { name: `Slide-uri (${SLIDE_COUNT + 1})` }),
      ).toBeVisible()

      await expect(toggle).toHaveText(/Editează ca slide-uri/)
      await toggle.click()
      await expect(page.getByTestId('song-slides-text-editor')).toHaveCount(0)
      await expect(page.getByText('Strofa noua').first()).toBeVisible()
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('works on a phone without horizontal scroll', async ({
    page,
    request,
  }) => {
    const song = await createLongSong(request)
    try {
      await page.setViewportSize({ width: 390, height: 800 })
      await openEditor(page, song.id)

      await page.getByTestId('song-slides-toggle-text-mode').click()
      await expect(page.getByTestId('song-slides-text-input')).toBeVisible()

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })
})
