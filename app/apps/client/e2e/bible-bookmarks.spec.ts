import { expect, type Page, test } from '@playwright/test'

/**
 * Bible bookmarks: the list itself, and moving it in and out as text.
 *
 * Serial, because every test here writes to the one global bookmark list.
 */
test.describe('Bible bookmarks', () => {
  test.describe.configure({ mode: 'serial' })

  /** Empties the list so a test starts from a known state. */
  async function clearBookmarks(page: Page) {
    await page.request.delete('/api/bible-bookmarks').catch(() => {})
  }

  /** Opens /bible with the Marcaje panel already expanded. */
  async function openBibleWithBookmarks(page: Page) {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('bible:bookmarks-open', 'true')
    })
    await page.goto('/bible')
    await expect(page.getByTestId('bible-bookmarks-panel')).toBeVisible({
      timeout: 15000,
    })
  }

  /**
   * Walks the reader down to a verse. The header toggle stays disabled until a
   * verse is actually in focus, so that is what we wait on.
   */
  async function selectVerse(page: Page, book: string, chapter: string) {
    await page.getByRole('button', { name: book, exact: true }).click()
    await page.getByRole('button', { name: chapter, exact: true }).click()

    // Verse rows carry the verse number followed by its text.
    await page
      .locator('main button')
      .filter({ hasText: /^\d+\D/ })
      .first()
      .click()

    await expect(page.getByTestId('bible-bookmark-toggle')).toBeEnabled({
      timeout: 10000,
    })
  }

  test.beforeEach(async ({ page }) => {
    await clearBookmarks(page)
  })

  test.afterAll(async ({ request }) => {
    await request.delete('/api/bible-bookmarks').catch(() => {})
  })

  test('the header toggle bookmarks the verse in focus and clears it again', async ({
    page,
  }) => {
    await openBibleWithBookmarks(page)
    await selectVerse(page, 'Ioan', '3')

    const toggle = page.getByTestId('bible-bookmark-toggle')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await toggle.click()

    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('bible-bookmark-item')).toHaveCount(1)

    // Turning it off again empties the list, so a second click cannot leave a
    // stray duplicate behind.
    await toggle.click()

    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByTestId('bible-bookmark-item')).toHaveCount(0)
  })

  test('import turns pasted references into bookmarks and reports bad lines', async ({
    page,
  }) => {
    await openBibleWithBookmarks(page)

    await page.getByTestId('bible-bookmarks-import').click()
    await page
      .getByTestId('bible-bookmarks-import-textarea')
      .fill(
        [
          '--- Chemare ---',
          'Psalmi 23:1-2',
          'Cartea Inventata 1:1',
          'Ioan 3',
        ].join('\n'),
      )
    await page.getByTestId('bible-bookmarks-import-confirm').click()

    // The range expands to one bookmark per verse, and the heading becomes a
    // note row.
    await expect(page.getByTestId('bible-bookmark-item')).toHaveCount(2)
    await expect(page.getByTestId('bible-bookmark-note')).toHaveCount(1)

    // Unusable lines are reported with their line number rather than dropped,
    // and the modal stays open so they can be corrected.
    const errors = page.getByTestId('bible-bookmarks-import-errors')
    await expect(errors).toBeVisible()
    await expect(errors).toContainText('3')
    await expect(errors).toContainText('Cartea Inventata 1:1')
    await expect(errors).toContainText('4')
    await expect(errors).toContainText('Ioan 3')
  })

  test('import closes itself when every line lands', async ({ page }) => {
    await openBibleWithBookmarks(page)

    await page.getByTestId('bible-bookmarks-import').click()
    await page
      .getByTestId('bible-bookmarks-import-textarea')
      .fill('Ioan 3:16\nPsalmi 23:1')
    await page.getByTestId('bible-bookmarks-import-confirm').click()

    await expect(page.getByTestId('bible-bookmarks-import-modal')).toBeHidden()
    await expect(page.getByTestId('bible-bookmark-item')).toHaveCount(2)
  })

  test('exported text imports back to the same list', async ({ request }) => {
    await request.post('/api/bible-bookmarks/import', {
      data: {
        text: ['--- Chemare ---', 'Ioan 3:16-17', 'Psalmi 23:1'].join('\n'),
      },
    })

    const exported = await (
      await request.get('/api/bible-bookmarks/export')
    ).json()
    expect(exported.data).toBeTruthy()

    const before = await (await request.get('/api/bible-bookmarks')).json()

    await request.delete('/api/bible-bookmarks')
    const reimport = await (
      await request.post('/api/bible-bookmarks/import', {
        data: { text: exported.data },
      })
    ).json()

    // Nothing is lost or mangled on the way out and back in.
    expect(reimport.data.errors).toEqual([])
    expect(reimport.data.imported).toBe(before.data.length)

    const after = await (await request.get('/api/bible-bookmarks')).json()
    expect(after.data.map((b: { reference: string }) => b.reference)).toEqual(
      before.data.map((b: { reference: string }) => b.reference),
    )

    const reexported = await (
      await request.get('/api/bible-bookmarks/export')
    ).json()
    expect(reexported.data).toBe(exported.data)
  })

  test('a chapter-only reference is refused rather than expanded', async ({
    request,
  }) => {
    const result = await (
      await request.post('/api/bible-bookmarks/import', {
        data: { text: 'Ioan 3' },
      })
    ).json()

    expect(result.data.imported).toBe(0)
    expect(result.data.errors).toHaveLength(1)
    expect(result.data.errors[0].reason).toBe('verse_required')
  })

  test('a reference can name its own translation', async ({ request }) => {
    const translations = await (
      await request.get('/api/bible/translations')
    ).json()
    const english = translations.data.find(
      (t: { language: string }) => t.language === 'en',
    )
    test.skip(!english, 'needs a second translation installed')

    const result = await (
      await request.post('/api/bible-bookmarks/import', {
        data: { text: `John 3:16 - ${english.abbreviation}` },
      })
    ).json()

    expect(result.data.imported).toBe(1)

    const list = await (await request.get('/api/bible-bookmarks')).json()
    expect(list.data[0].translationAbbreviation).toBe(english.abbreviation)
  })
})
