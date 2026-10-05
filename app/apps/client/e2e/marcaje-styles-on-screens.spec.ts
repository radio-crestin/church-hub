import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * Marcaje styles are anchored to the verse text, not to what a screen draws
 * around it: a screen that puts the reference in front of the verse marks the
 * same words as one that does not, and a word underlined in such a preview is
 * saved at the verse's own offsets.
 *
 * Serial: these tests drive the one global presentation state.
 */
test.describe('Marcaje styles on every screen', () => {
  test.describe.configure({ mode: 'serial' })

  interface Screen {
    id: number
    type: string
    isPreviewScreen: boolean
    sortOrder: number
  }

  interface Verse {
    id: number
    text: string
    reference: string
    bookName: string
    bookCode: string
    bookId: number
    chapter: number
    verse: number
    translationId: number
  }

  async function john316(request: APIRequestContext): Promise<Verse> {
    const search = await (
      await request.get('/api/bible/search?q=Ioan%203:16')
    ).json()
    return search.data.results[0]
  }

  async function present(request: APIRequestContext, verse: Verse) {
    const response = await request.post('/api/presentation/temporary-bible', {
      data: {
        verseId: verse.id,
        reference: `${verse.bookName} ${verse.chapter}:${verse.verse}`,
        text: verse.text,
        translationAbbreviation: 'RCCV',
        bookName: verse.bookName,
        translationId: verse.translationId,
        bookId: verse.bookId,
        bookCode: verse.bookCode,
        chapter: verse.chapter,
        currentVerseIndex: verse.verse - 1,
      },
    })
    expect(response.ok()).toBeTruthy()
  }

  async function screens(request: APIRequestContext): Promise<Screen[]> {
    return (await (await request.get('/api/screens')).json()).data
  }

  /** Same choice LivePreview makes: the flagged preview screen, else the first primary. */
  function previewScreenOf(all: Screen[]): Screen {
    return (
      all.find((screen) => screen.isPreviewScreen) ??
      all
        .filter((screen) => screen.type === 'primary')
        .sort((a, b) => a.sortOrder - b.sortOrder)[0]
    )
  }

  /** Serves the screen with the reference put in front of the verse. */
  async function prependReferenceOn(page: Page, screenId: number) {
    await page.route(`**/api/screens/${screenId}`, async (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      const response = await route.fetch()
      const body = await response.json()
      body.data.contentConfigs.bible.includeReferenceInContent = true
      await route.fulfill({ response, json: body })
    })
  }

  test.beforeEach(async ({ request }) => {
    await request.put('/api/presentation/highlights', { data: { ranges: [] } })
  })

  test.afterAll(async ({ request }) => {
    await request.put('/api/presentation/highlights', { data: { ranges: [] } })
    await request.post('/api/presentation/clear-temporary').catch(() => {})
  })

  test('a screen that puts the reference first underlines the same word', async ({
    page,
    request,
  }) => {
    const verse = await john316(request)
    await present(request, verse)
    const start = verse.text.indexOf('lumea')
    await request.put('/api/presentation/highlights', {
      data: {
        ranges: [{ id: 'u', start, end: start + 5, underline: true }],
      },
    })

    const livestream = (await screens(request)).find(
      (screen) => screen.type === 'livestream',
    )
    expect(livestream, 'the default live stream screen exists').toBeTruthy()

    await prependReferenceOn(page, livestream!.id)
    await page.goto(`/screen/${livestream!.id}`)
    // The live stream screen draws "(Ioan 3:16) Fiindcă ..."
    await expect(page.locator('[data-style-anchor]:visible')).toContainText(
      'Ioan 3:16',
      { timeout: 15000 },
    )
    await expect(page.locator('u:visible')).toHaveText('lumea', {
      timeout: 15000,
    })
  })

  test('a word underlined in a preview that shows the reference is saved at the verse offsets', async ({
    page,
    request,
  }) => {
    const verse = await john316(request)
    await present(request, verse)
    const preview = previewScreenOf(await screens(request))
    await prependReferenceOn(page, preview.id)

    await page.goto('/')
    await page.evaluate(() =>
      localStorage.setItem('bible:bookmarks-open', 'true'),
    )
    await page.goto('/bible')

    const livePreview = page
      .locator('[data-testid="live-preview"]:visible')
      .first()
    const anchor = livePreview.locator('[data-style-anchor]:visible').first()
    await expect(anchor).toContainText('Fiindcă', { timeout: 15000 })
    // The preview shows the reference in front of the verse.
    await expect(anchor).toHaveAttribute('data-style-anchor', /^[1-9]\d*$/)

    // Select "lumea" the way a mouse drag would.
    await anchor.evaluate((element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      let node = walker.nextNode()
      while (node && !node.textContent?.includes('lumea')) {
        node = walker.nextNode()
      }
      if (!node) throw new Error('word not drawn')
      const at = node.textContent!.indexOf('lumea')
      const range = document.createRange()
      range.setStart(node, at)
      range.setEnd(node, at + 5)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)
    })
    await page.waitForTimeout(200)

    await anchor.click({ button: 'right' })
    await page.getByRole('button', { name: /^(Underline|Subliniere)$/ }).click()

    const start = verse.text.indexOf('lumea')
    await expect
      .poll(async () => {
        const saved = await (
          await request.get('/api/presentation/highlights')
        ).json()
        return saved.data.map((range: { start: number; end: number }) => [
          range.start,
          range.end,
        ])
      })
      .toEqual([[start, start + 5]])

    // And the preview, which prepends the reference, draws it on "lumea".
    await expect(livePreview.locator('u:visible')).toHaveText('lumea')
  })
})
