import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * History (Istoric) and Bookmarks (Marcaje) on the Bible page: a click picks
 * the verse without presenting it; a double-click shows it on screen.
 *
 * Serial, because the history, the bookmarks and the screen are global.
 */

/** The verse on the screens, as "Book chapter:verse", or null. */
async function presentedReference(request: APIRequestContext) {
  const state = (await (await request.get('/api/presentation/state')).json())
    .data
  const content = state.temporaryContent
  if (state.isHidden || content?.type !== 'bible') return null
  return `${content.data.bookName} ${content.data.chapter}:${content.data.currentVerseIndex + 1}`
}

/** Opens /bible with one side panel already expanded. */
async function openBibleWithPanel(page: Page, panel: 'history' | 'bookmarks') {
  await page.addInitScript((key) => {
    window.localStorage.setItem('church-hub-language', 'ro')
    window.localStorage.setItem(key, 'true')
  }, `bible:${panel}-open`)
  await page.goto('/bible')
}

test.describe('Bible History and Bookmarks double-click', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary')
    await request.delete('/api/bible-history')
    await request.delete('/api/bible-bookmarks')
  })

  test.afterAll(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary')
    await request.delete('/api/bible-history')
    await request.delete('/api/bible-bookmarks')
  })

  test('a history entry is picked on a click and shown on a double-click', async ({
    page,
    request,
  }) => {
    await request.post('/api/bible-history', {
      data: {
        verseId: 900101,
        reference: 'Psalmi 23:1 - VDCC',
        text: 'Domnul este Păstorul meu',
        translationAbbreviation: 'VDCC',
        bookName: 'Psalmi',
        translationId: 1,
        bookId: 19,
        chapter: 23,
        verse: 1,
      },
    })
    await openBibleWithPanel(page, 'history')
    const entry = page.getByTestId('bible-history-item').first()
    await expect(entry).toBeVisible({ timeout: 15000 })

    await entry.click()
    await expect(page).toHaveURL(/select=true/)
    expect(await presentedReference(request)).toBeNull()

    await entry.dblclick()
    await expect
      .poll(() => presentedReference(request))
      .toMatch(/^Psalmii? 23:1$/)
  })

  test('a bookmark is shown on a double-click', async ({ page, request }) => {
    await request.post('/api/bible-bookmarks/import', {
      data: { text: ['Psalmi 23:1', 'Ioan 3:16'].join('\n') },
    })
    await openBibleWithPanel(page, 'bookmarks')
    const bookmark = page
      .getByTestId('bible-bookmark-item')
      .filter({ hasText: 'Ioan 3:16' })
      .getByRole('button')
      .filter({ hasText: 'Ioan 3:16' })
    await expect(bookmark).toBeVisible({ timeout: 15000 })

    await bookmark.dblclick()
    await expect.poll(() => presentedReference(request)).toBe('Ioan 3:16')
  })
})
