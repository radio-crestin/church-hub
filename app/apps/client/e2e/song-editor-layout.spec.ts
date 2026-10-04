import { expect, type Page, test } from '@playwright/test'

import { selectAction } from './helpers/actions-menu'

/**
 * The song editor (opened from the song page's top-right corner):
 *  - no Programe panel, the slide rail sits on the right of the form and can be
 *    resized and moved like the song page's panels,
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

      // Only the form and the rail are panels; Programe is gone.
      await expect(
        page.locator('[data-testid^="workspace-panel-"]'),
      ).toHaveCount(2)
      await expect(
        page.locator('main').getByText('Programe', { exact: true }),
      ).toHaveCount(0)

      const rail = page.getByTestId('workspace-panel-rail')
      await expect(rail).toBeVisible()
      await expect(page.getByTestId('song-editor-slide-rail')).toBeVisible()
      const railBox = await rail.boundingBox()
      const formBox = await page
        .getByTestId('workspace-panel-form')
        .boundingBox()
      expect(railBox).not.toBeNull()
      expect(formBox).not.toBeNull()
      if (!railBox || !formBox) return
      expect(railBox.x).toBeGreaterThanOrEqual(formBox.x + formBox.width - 2)
      expect(railBox.x + railBox.width).toBeLessThanOrEqual(1600)
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('the rail can be resized and the width is remembered', async ({
    page,
    request,
  }) => {
    const song = await createLongSong(request)
    try {
      await page.setViewportSize({ width: 1600, height: 900 })
      await openEditor(page, song.id)

      const rail = page.getByTestId('workspace-panel-rail')
      const before = await rail.boundingBox()
      const handle = await page
        .locator('[role="separator"]')
        .first()
        .boundingBox()
      expect(before).not.toBeNull()
      expect(handle).not.toBeNull()
      if (!before || !handle) return
      const x = handle.x + handle.width / 2
      const y = handle.y + handle.height / 2
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x - 150, y, { steps: 20 })
      await page.mouse.up()

      const widened = await rail.boundingBox()
      expect(widened?.width ?? 0).toBeGreaterThan(before.width + 80)

      await page.reload()
      await expect(rail).toBeVisible()
      const restored = await rail.boundingBox()
      expect(
        Math.abs((restored?.width ?? 0) - (widened?.width ?? 0)),
      ).toBeLessThan(12)
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('Edit layout lets the rail move next to the form, and the move sticks', async ({
    page,
    request,
  }) => {
    const song = await createLongSong(request)
    try {
      await page.setViewportSize({ width: 1600, height: 900 })
      await openEditor(page, song.id)

      await selectAction(
        page,
        'song-editor-actions-menu',
        'workspace-edit-layout',
      )
      const grip = await page.getByTestId('workspace-move-rail').boundingBox()
      const form = await page.getByTestId('workspace-panel-form').boundingBox()
      expect(grip).not.toBeNull()
      expect(form).not.toBeNull()
      if (!grip || !form) return

      // Onto the form's left edge: the rail goes before the form.
      await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
      await page.mouse.down()
      await page.mouse.move(form.x + 12, form.y + form.height / 2, {
        steps: 25,
      })
      await page.mouse.move(form.x + 10, form.y + form.height / 2, { steps: 5 })
      await page.mouse.up()

      await page.getByTestId('workspace-done-editing').click()
      const isBeforeForm = async () => {
        const rail = await page
          .getByTestId('workspace-panel-rail')
          .boundingBox()
        const form = await page
          .getByTestId('workspace-panel-form')
          .boundingBox()
        return !!rail && !!form && (rail.x < form.x - 2 || rail.y < form.y - 2)
      }
      expect(await isBeforeForm()).toBe(true)

      await page.reload()
      await expect(page.getByTestId('workspace-panel-rail')).toBeVisible()
      expect(await isBeforeForm()).toBe(true)
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
