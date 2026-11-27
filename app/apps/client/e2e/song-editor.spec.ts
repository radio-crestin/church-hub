import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test'

/**
 * The one song editor (T-201). Edit is the last button of the song page's top
 * bar and opens the PowerPoint-style slide editor right there; "Text" turns
 * the whole song into one text (chords in brackets, #labels, a blank line
 * between slides) and back; the song's details sit beside it; Save stores it
 * all. The separate edit page is gone and its address leads here.
 */

const SLIDE_COUNT = 60

interface StoredSlide {
  id: number
  content: string
  label: string | null
  notes: string | null
  chords: Array<{ wordIndex: number; chord: string }> | null
}

async function createSong(
  request: APIRequestContext,
  slides: Array<Record<string, unknown>>,
  title = `E2E Song editor ${Date.now()}`,
) {
  const response = await request.post('/api/songs', {
    data: { title, keyLine: 'Sol Major', slides },
  })
  expect(response.status()).toBe(201)
  const { data } = await response.json()
  return data as { id: number; title: string }
}

function longSongSlides() {
  return Array.from({ length: SLIDE_COUNT }, (_, i) => ({
    content: `<p>Strofa ${i + 1} linia unu</p><p>Strofa ${i + 1} linia doi</p><p>Strofa ${i + 1} linia trei</p>`,
    sortOrder: i,
  }))
}

async function storedSlides(
  request: APIRequestContext,
  songId: number,
): Promise<StoredSlide[]> {
  const { data } = await (await request.get(`/api/songs/${songId}`)).json()
  return data.slides
}

async function openTextEditor(page: Page, songId: number): Promise<Locator> {
  await page.goto(`/songs/${songId}?edit=slides`)
  await page.getByTestId('song-editor-mode-text').click()
  const textarea = page.getByTestId('song-text-input')
  await expect(textarea).toBeVisible()
  return textarea
}

async function save(page: Page) {
  await page.getByTestId('song-editor-save').click()
  await expect(page.getByTestId('song-editor-save')).toBeDisabled({
    timeout: 10000,
  })
}

test.describe('Song editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sidebar-collapsed', 'true')
    })
  })

  test('Edit is the last button of the top bar and opens the slide editor', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, [
      { content: '<p>Prima strofă</p>', sortOrder: 0 },
      { content: '<p>A doua strofă</p>', sortOrder: 1 },
    ])
    try {
      await page.setViewportSize({ width: 1600, height: 900 })
      await page.goto(`/songs/${song.id}`)

      const edit = page.getByTestId('song-edit')
      await expect(edit).toBeVisible()
      // Last in the bar: nothing to its right in its row.
      const isLast = await edit.evaluate(
        (button) => button.parentElement?.lastElementChild === button,
      )
      expect(isLast).toBe(true)

      await edit.click()
      await expect(page).toHaveURL(
        new RegExp(`/songs/${song.id}\\?edit=slides`),
      )
      // Straight into the slide editor: thumbnails, the stage, the details.
      await expect(page.getByTestId('song-editor-slides')).toBeVisible()
      await expect(page.getByTestId('stage-thumbnail')).toHaveCount(2)
      await expect(page.getByTestId('slide-canvas-box')).toContainText(
        'Prima strofă',
      )
      await expect(page.getByTestId('song-editor-details')).toBeVisible()
      await expect(page.getByTestId('song-editor-mode-slides')).toHaveAttribute(
        'aria-checked',
        'true',
      )

      // Done goes back to the song page.
      await page.getByTestId('song-editor-done').click()
      await expect(page).toHaveURL(new RegExp(`/songs/${song.id}$`))
      await expect(page.getByTestId('song-edit')).toBeVisible()
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('Text switches to the song as text and back, keeping chords, labels and notes', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, [
      {
        content: '<p>Har minunat ce m-a salvat</p>',
        sortOrder: 0,
        label: 'V1',
        notes: 'Încet',
        chords: [
          { wordIndex: 0, chord: 'G' },
          { wordIndex: 2, chord: 'D' },
        ],
      },
      { content: '<p>Refrenul cântării</p>', sortOrder: 1, label: 'C1' },
    ])
    try {
      await page.setViewportSize({ width: 1600, height: 900 })
      const textarea = await openTextEditor(page, song.id)
      await expect(page.getByTestId('song-editor-text')).toBeVisible()
      await expect(page.getByTestId('stage-thumbnail')).toHaveCount(0)

      // Chords before their words, the label on its own line.
      await expect(textarea).toHaveValue(
        '#V1\n[G]Har minunat [D]ce m-a salvat\n\n#C1\nRefrenul cântării',
      )
      await expect(page.getByTestId('song-text-slide-number')).toHaveText([
        '1',
        '2',
      ])

      // Move a chord, edit the chorus, add a slide.
      await textarea.fill(
        '#V1\n[G]Har minunat ce [Em]m-a salvat\n\n#C1\nRefrenul cântării nou\n\n#V2\n[C]A doua strofă',
      )
      await expect(page.getByTestId('song-text-slide-number')).toHaveCount(3)

      // Back to the slides: the edit is there.
      await page.getByTestId('song-editor-mode-slides').click()
      await expect(page.getByTestId('stage-thumbnail')).toHaveCount(3)
      await expect(page.getByTestId('stage-thumbnail').nth(1)).toContainText(
        'Refrenul cântării nou',
      )

      await save(page)
      const slides = await storedSlides(request, song.id)
      expect(slides).toHaveLength(3)
      expect(slides[0].label).toBe('V1')
      // The note was not in the text and stays with its slide.
      expect(slides[0].notes).toBe('Încet')
      expect(slides[0].chords).toEqual([
        { wordIndex: 0, chord: 'G' },
        { wordIndex: 3, chord: 'Em' },
      ])
      expect(slides[1].content).toContain('Refrenul cântării nou')
      expect(slides[2].label).toBe('V2')
      expect(slides[2].chords).toEqual([{ wordIndex: 0, chord: 'C' }])
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('chords are put on a slide’s words in the slide editor', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, [
      { content: '<p>Cât de mare ești</p>', sortOrder: 0 },
    ])
    try {
      await page.setViewportSize({ width: 1600, height: 900 })
      await page.goto(`/songs/${song.id}?edit=slides`)

      const toggle = page.getByTestId('slide-chords-toggle')
      if ((await toggle.getAttribute('aria-pressed')) !== 'true') {
        await toggle.click()
      }
      await page.getByTestId('slide-chord-word').nth(2).click()
      await page.getByTestId('slide-chord-filter').fill('Am')
      await page.keyboard.press('Enter')
      // Shown in the app's language (La minor is "Lam" in Romanian).
      await expect(page.getByTestId('slide-chord')).toHaveText([/^(Am|Lam)$/])

      await page.getByTestId('slide-label-select').selectOption('C1')
      await save(page)

      const [slide] = await storedSlides(request, song.id)
      expect(slide.chords).toEqual([{ wordIndex: 2, chord: 'Am' }])
      expect(slide.label).toBe('C1')
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('the song details are edited beside the slides and saved with them', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, [
      { content: '<p>Strofa</p>', sortOrder: 0 },
    ])
    try {
      await page.setViewportSize({ width: 1600, height: 900 })
      await page.goto(`/songs/${song.id}?edit=slides`)

      const details = page.getByTestId('song-editor-details')
      const title = details.locator('input').first()
      await title.fill(`${song.title} (nou)`)
      await expect(page.getByTestId('song-editor-title')).toHaveText(
        `${song.title} (nou)`,
      )
      await save(page)

      const { data } = await (await request.get(`/api/songs/${song.id}`)).json()
      expect(data.title).toBe(`${song.title} (nou)`)
      expect(data.keyLine).toBe('Sol Major')
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('a new song is written in the same editor and keeps it once saved', async ({
    page,
    request,
  }) => {
    const title = `E2E New in editor ${Date.now()}`
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/songs/new')
    await expect(page.getByTestId('song-editor')).toBeVisible()
    await page
      .getByTestId('song-editor-details')
      .locator('input')
      .first()
      .fill(title)
    await page.getByTestId('song-editor-mode-text').click()
    await page.getByTestId('song-text-input').fill('Prima\n\nA doua')
    await page.getByTestId('song-editor-save').click()

    await expect(page).toHaveURL(/\/songs\/\d+\?.*edit=/, {
      timeout: 10000,
    })
    const songId = Number(new URL(page.url()).pathname.split('/').pop())
    try {
      await expect(page.getByTestId('song-editor-save')).toBeDisabled()
      const slides = await storedSlides(request, songId)
      expect(slides.map((s) => s.content)).toEqual([
        '<p>Prima</p>',
        '<p>A doua</p>',
      ])
    } finally {
      await request.delete(`/api/songs/${songId}`)
    }
  })
})

test.describe('Song text editor on a long song', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sidebar-collapsed', 'true')
    })
  })

  test('stays responsive while typing', async ({ page, request }) => {
    const song = await createSong(request, longSongSlides())
    try {
      await page.setViewportSize({ width: 1600, height: 900 })
      const textarea = await openTextEditor(page, song.id)

      // From a key to the next painted frame, for 40 keys in a row.
      const median = await textarea.evaluate(
        async (el: HTMLTextAreaElement) => {
          el.focus()
          el.setSelectionRange(el.value.length, el.value.length)
          const times: number[] = []
          for (let i = 0; i < 40; i += 1) {
            const start = performance.now()
            document.execCommand('insertText', false, 'a')
            await new Promise((resolve) =>
              requestAnimationFrame(() => setTimeout(resolve, 0)),
            )
            times.push(performance.now() - start)
          }
          times.sort((a, b) => a - b)
          return times[20]
        },
      )
      // One or two frames; the old editor re-parsed the song on every key.
      expect(median).toBeLessThan(40)
      await expect(page.getByTestId('song-text-slide-count')).toContainText(
        String(SLIDE_COUNT),
      )
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('opens at the start and keeps the slide numbers level with their lines', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, longSongSlides())
    try {
      await page.setViewportSize({ width: 1600, height: 900 })
      const textarea = await openTextEditor(page, song.id)
      const scroller = page.getByTestId('song-text-scroll')
      await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(0)

      // Each slide is 3 lines and a blank one: slide n starts on line
      // (n - 1) * 4, 24px a line after 12px of padding. Slide 27: line 104.
      await scroller.evaluate((el) => {
        el.scrollTop = 104 * 24
      })
      const number = page
        .getByTestId('song-text-slide-number')
        .filter({ hasText: /^27$/ })
      await expect(number).toBeInViewport()
      const textBox = await textarea.boundingBox()
      const numberBox = await number.boundingBox()
      // On its line, wherever the text is scrolled to.
      expect(Math.round((numberBox?.y ?? 0) - (textBox?.y ?? 0))).toBe(
        12 + 104 * 24,
      )
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('keeps the caret in view when typing at the end', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, longSongSlides())
    try {
      await page.setViewportSize({ width: 1600, height: 900 })
      const textarea = await openTextEditor(page, song.id)
      await textarea.evaluate((el: HTMLTextAreaElement) => {
        el.setSelectionRange(el.value.length, el.value.length)
      })
      await page.keyboard.type('\n\nNou 1\nNou 2\nNou 3')
      const fromEnd = await page
        .getByTestId('song-text-scroll')
        .evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop)
      expect(fromEnd).toBeLessThanOrEqual(60)
      await expect(page.getByTestId('song-text-slide-count')).toContainText(
        String(SLIDE_COUNT + 1),
      )
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('works on a phone without horizontal scroll', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, longSongSlides())
    try {
      await page.setViewportSize({ width: 390, height: 800 })
      const textarea = await openTextEditor(page, song.id)
      await expect(textarea).toBeVisible()
      expect(
        (await page.getByTestId('song-text-scroll').boundingBox())?.height ?? 0,
      ).toBeGreaterThan(400)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)

      await page.getByTestId('song-editor-mode-slides').click()
      await expect(page.getByTestId('slide-canvas-box')).toBeVisible()
      const slidesOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(slidesOverflow).toBeLessThanOrEqual(0)
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })
})
