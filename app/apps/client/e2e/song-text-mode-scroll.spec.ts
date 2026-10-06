import { expect, type Page, test } from '@playwright/test'

/**
 * Text editing of a long song on the song page ("Editează" in the slides
 * panel):
 *  - it opens at the start of the song, not scrolled to the last line,
 *  - the wheel scrolls the text even with the pointer over a green slide button,
 *  - the slide buttons stay level with their lines while scrolling,
 *  - typing at the end keeps the caret in view.
 */

const SLIDE_COUNT = 60

async function createLongSong(
  request: import('@playwright/test').APIRequestContext,
) {
  const slides = Array.from({ length: SLIDE_COUNT }, (_, i) => ({
    content: `<p>Strofa ${i + 1} linia unu</p><p>Strofa ${i + 1} linia doi</p><p>Strofa ${i + 1} linia trei</p>`,
    sortOrder: i,
  }))
  const response = await request.post('/api/songs', {
    data: { title: `E2E Long Text ${Date.now()}`, slides },
  })
  expect(response.status()).toBe(201)
  const { data } = await response.json()
  return data as { id: number }
}

async function openTextMode(page: Page, songId: number) {
  await page.addInitScript(() => {
    window.localStorage.setItem('sidebar-collapsed', 'true')
    window.localStorage.setItem('church-hub-language', 'ro')
  })
  await page.goto(`/songs/${songId}`)
  await page.getByTestId('toggle-slides-edit-mode').click()
  const textarea = page.getByTestId('slides-text-textarea')
  await expect(textarea).toBeVisible()
  return textarea
}

const scrollTopOf = (textarea: ReturnType<Page['locator']>) =>
  textarea.evaluate((el) => el.scrollTop)

test.describe('Song text mode on a long song', () => {
  test('opens at the start and scrolls with the wheel over a slide button', async ({
    page,
    request,
  }) => {
    const song = await createLongSong(request)
    try {
      await page.setViewportSize({ width: 1600, height: 900 })
      const textarea = await openTextMode(page, song.id)

      await expect.poll(() => scrollTopOf(textarea)).toBe(0)

      const button = page.locator('button[title="Afișează acest slide"]').nth(2)
      const box = await button.boundingBox()
      expect(box).not.toBeNull()
      if (!box) return
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.wheel(0, 600)
      await expect.poll(() => scrollTopOf(textarea)).toBeGreaterThan(400)
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('keeps the slide buttons level with their lines after scrolling', async ({
    page,
    request,
  }) => {
    const song = await createLongSong(request)
    try {
      await page.setViewportSize({ width: 1600, height: 900 })
      const textarea = await openTextMode(page, song.id)

      await textarea.evaluate((el) => {
        el.scrollTop = 3000
      })
      // Every block is 3 lines + 3 for the separator: slide n starts at
      // line (n - 1) * 6. 3000px / 20px = line 150 = slide 26.
      const button = page.locator('button', { hasText: /^26$/ })
      await expect(button).toBeVisible()
      const textBox = await textarea.boundingBox()
      const buttonBox = await button.boundingBox()
      expect(textBox).not.toBeNull()
      expect(buttonBox).not.toBeNull()
      if (!textBox || !buttonBox) return
      // Line 150 sits at padding(8) - scrollTop(3000) + 150 * 20 = 8px below
      // the textarea's inner top (1px border).
      expect(Math.abs(buttonBox.y - (textBox.y + 1 + 8))).toBeLessThanOrEqual(2)
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('keeps the caret in view when typing at the end', async ({
    page,
    request,
  }) => {
    const song = await createLongSong(request)
    try {
      await page.setViewportSize({ width: 1600, height: 900 })
      const textarea = await openTextMode(page, song.id)

      await textarea.click()
      await textarea.evaluate((el: HTMLTextAreaElement) => {
        el.setSelectionRange(el.value.length, el.value.length)
      })
      await page.keyboard.type('\n\n---\n\nNou 1\nNou 2\nNou 3')
      const atEnd = await textarea.evaluate(
        (el) => el.scrollHeight - el.clientHeight - el.scrollTop,
      )
      expect(atEnd).toBeLessThanOrEqual(40)
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('gives the text room on a phone', async ({ page, request }) => {
    const song = await createLongSong(request)
    try {
      await page.setViewportSize({ width: 390, height: 800 })
      const textarea = await openTextMode(page, song.id)
      const box = await textarea.boundingBox()
      expect(box?.height ?? 0).toBeGreaterThan(400)
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })
})
