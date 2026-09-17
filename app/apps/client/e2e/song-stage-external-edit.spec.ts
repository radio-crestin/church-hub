import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { selectAction } from './helpers/actions-menu'

/**
 * The PowerPoint stage holds its own copy of the song's slides so it can
 * autosave while the operator types. A save of the same song made elsewhere —
 * the song editor modal behind the Marcaje/Programe pencil, or the Edit page —
 * has to reach that copy: otherwise the stage keeps showing the old lyrics
 * until the song is reopened, and its next autosave writes them back over the
 * edit.
 */

interface SlideInput {
  content: string
  notes?: string
  styleOverrides?: { fontScale: number }
}

interface SavedSlide {
  id: number
  content: string
  notes: string | null
  styleOverrides: { fontScale?: number } | null
}

async function createSong(
  request: APIRequestContext,
  title: string,
  slides: SlideInput[],
): Promise<{ id: number }> {
  const response = await request.post('/api/songs', {
    data: {
      title,
      slides: slides.map((slide, index) => ({ ...slide, sortOrder: index })),
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data
}

async function readSlides(
  request: APIRequestContext,
  songId: number,
): Promise<SavedSlide[]> {
  const response = await request.get(`/api/songs/${songId}`)
  return (await response.json()).data.slides
}

async function removeSong(request: APIRequestContext, songId: number) {
  const response = await request.get('/api/song-bookmarks')
  const bookmarks = (await response.json()).data as Array<{
    id: number
    songId: number
  }>
  for (const bookmark of bookmarks) {
    if (bookmark.songId === songId) {
      await request.delete(`/api/song-bookmarks/${bookmark.id}`)
    }
  }
  await request.delete(`/api/songs/${songId}`)
}

async function openStage(page: Page, songId: number, slideCount: number) {
  await page.addInitScript(() => {
    window.localStorage.setItem('song-editor-layout', 'powerpoint')
    window.localStorage.setItem('song-detail:bookmarks-open', 'true')
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/songs/${songId}`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByTestId('stage-thumbnail')).toHaveCount(slideCount, {
    timeout: 10000,
  })
}

/**
 * Rewrites the first slide in the editor modal opened from Marcaje and saves.
 * Resolves once the song page has fetched the song again, which is the moment
 * the stage gets to see the save.
 */
async function saveFirstSlideFromModal(
  page: Page,
  title: string,
  songId: number,
  text: string,
) {
  const row = page.getByTestId('bookmark-item').filter({ hasText: title })
  await expect(row).toBeVisible({ timeout: 10000 })
  await row.getByTestId('bookmark-song-edit').click()

  const modal = page.getByTestId('song-editor-modal')
  await expect(modal).toBeVisible({ timeout: 10000 })
  const firstSlide = modal.locator('.ProseMirror').first()
  await expect(firstSlide).toBeVisible({ timeout: 10000 })
  await firstSlide.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type(text)

  const refetched = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().endsWith(`/api/songs/${songId}`),
  )
  await modal.getByTestId('song-editor-modal-save').click()
  await expect(modal).toBeHidden({ timeout: 10000 })
  await refetched
}

test.describe('PowerPoint stage and saves made elsewhere', () => {
  test('a save from the editor modal shows on the stage without a reload', async ({
    page,
    request,
  }) => {
    const title = `E2E Stage Modal ${Date.now()}`
    const song = await createSong(request, title, [
      { content: 'Alpha original' },
      { content: 'Beta original' },
      { content: 'Gamma original' },
    ])

    try {
      await request.post('/api/song-bookmarks', { data: { songId: song.id } })
      await openStage(page, song.id, 3)
      const stage = page.locator('[data-editing]')
      await expect(stage).toContainText('Alpha original', { timeout: 10000 })

      await saveFirstSlideFromModal(page, title, song.id, 'Alpha from modal')

      const thumbs = page.getByTestId('stage-thumbnail')
      await expect(thumbs.nth(0)).toContainText('Alpha from modal')
      await expect(stage).toContainText('Alpha from modal')
      await expect(thumbs.nth(0)).toHaveAttribute('aria-current', 'true')
    } finally {
      await removeSong(request, song.id)
    }
  })

  test('editing the stage after a modal save keeps the modal edit', async ({
    page,
    request,
  }) => {
    const title = `E2E Stage No Clobber ${Date.now()}`
    const song = await createSong(request, title, [
      { content: 'Alpha original' },
      { content: 'Beta original' },
      { content: 'Gamma original' },
    ])

    try {
      await request.post('/api/song-bookmarks', { data: { songId: song.id } })
      await openStage(page, song.id, 3)

      await saveFirstSlideFromModal(page, title, song.id, 'Alpha from modal')

      // An unrelated edit on the stage autosaves the whole song…
      await page.getByTestId('stage-thumbnail').nth(1).click()
      await page.locator('[data-editing]').click()
      await expect(page.getByTestId('slide-canvas-editable')).toBeVisible()
      await page.keyboard.type(' plus stage')
      await expect
        .poll(async () => (await readSlides(request, song.id))[1].content, {
          timeout: 10000,
        })
        .toContain('plus stage')

      // …and must not write the stage's old copy of slide 1 over the modal's.
      const slides = await readSlides(request, song.id)
      expect(slides[0].content).toContain('Alpha from modal')
    } finally {
      await removeSong(request, song.id)
    }
  })

  test('a save made elsewhere replaces the text of a slide open for editing', async ({
    page,
    request,
  }) => {
    const title = `E2E Stage Open Editor ${Date.now()}`
    const song = await createSong(request, title, [
      { content: 'Alpha original' },
      { content: 'Beta original' },
    ])

    try {
      await openStage(page, song.id, 2)
      const stage = page.locator('[data-editing]')
      await stage.click()
      const editable = page.getByTestId('slide-canvas-editable')
      await expect(editable).toContainText('Alpha original')

      // Another device saves the song while the slide is open but untouched.
      const slides = await readSlides(request, song.id)
      const response = await request.post('/api/songs', {
        data: {
          id: song.id,
          title,
          slides: [
            { id: slides[0].id, content: 'Alpha from elsewhere', sortOrder: 0 },
            { id: slides[1].id, content: 'Beta original', sortOrder: 1 },
          ],
        },
      })
      expect(response.ok()).toBeTruthy()

      await expect(editable).toContainText('Alpha from elsewhere', {
        timeout: 10000,
      })
      await expect(stage).toHaveAttribute('data-editing', 'true')
    } finally {
      await removeSong(request, song.id)
    }
  })

  test('a save from the Edit page shows on the stage when it returns', async ({
    page,
    request,
  }) => {
    const song = await createSong(
      request,
      `E2E Stage Edit Page ${Date.now()}`,
      [
        { content: 'Alpha original' },
        {
          content: 'Beta original',
          notes: 'Beta speaker note',
          styleOverrides: { fontScale: 1.25 },
        },
      ],
    )

    try {
      await openStage(page, song.id, 2)

      await selectAction(page, 'song-actions-menu', 'song-edit')
      await page.waitForURL(/\/edit$/)
      const firstSlide = page.locator('.ProseMirror').first()
      await expect(firstSlide).toBeVisible({ timeout: 10000 })
      await firstSlide.click()
      await page.keyboard.press('ControlOrMeta+a')
      await page.keyboard.type('Alpha from edit page')
      await page.getByTestId('song-editor-save').click()

      await page.waitForURL((url) => !url.pathname.endsWith('/edit'))
      const thumbs = page.getByTestId('stage-thumbnail')
      await expect(thumbs).toHaveCount(2, { timeout: 10000 })
      await expect(thumbs.nth(0)).toContainText('Alpha from edit page', {
        timeout: 10000,
      })

      // The Edit page never shows notes or styling, so saving it must leave
      // them as they were.
      const slides = await readSlides(request, song.id)
      expect(slides[1].notes).toBe('Beta speaker note')
      expect(slides[1].styleOverrides).toEqual({ fontScale: 1.25 })
    } finally {
      await removeSong(request, song.id)
    }
  })

  test('speaker notes and slide styling survive a modal save', async ({
    page,
    request,
  }) => {
    const title = `E2E Stage Modal Notes ${Date.now()}`
    const song = await createSong(request, title, [
      {
        content: 'Alpha original',
        notes: 'Alpha speaker note',
        styleOverrides: { fontScale: 1.5 },
      },
      {
        content: 'Beta original',
        notes: 'Beta speaker note',
        styleOverrides: { fontScale: 0.8 },
      },
    ])

    try {
      await request.post('/api/song-bookmarks', { data: { songId: song.id } })
      await openStage(page, song.id, 2)

      await saveFirstSlideFromModal(page, title, song.id, 'Alpha from modal')

      const slides = await readSlides(request, song.id)
      expect(slides[0].content).toContain('Alpha from modal')
      expect(
        slides.map((slide) => ({
          notes: slide.notes,
          styleOverrides: slide.styleOverrides,
        })),
      ).toEqual([
        { notes: 'Alpha speaker note', styleOverrides: { fontScale: 1.5 } },
        { notes: 'Beta speaker note', styleOverrides: { fontScale: 0.8 } },
      ])
    } finally {
      await removeSong(request, song.id)
    }
  })
})
