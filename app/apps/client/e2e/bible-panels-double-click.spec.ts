import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { openActionsMenu } from './helpers/actions-menu'

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

/** Settings → Bible: "Present a verse as soon as I pick it". */
async function setAutoPresent(request: APIRequestContext, enabled: boolean) {
  await request.post('/api/settings/app_settings', {
    data: { key: 'bible_auto_present_on_select', value: String(enabled) },
  })
}

const HISTORY_VERSE = {
  verseId: 900102,
  reference: 'Ioan 3:16 - VDCC',
  text: 'Fiindcă atât de mult a iubit Dumnezeu lumea',
  translationAbbreviation: 'VDCC',
  bookName: 'Ioan',
  translationId: 1,
  bookId: 43,
  chapter: 3,
  verse: 16,
}

test.describe('Bible History and Bookmarks double-click', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary')
    await request.delete('/api/bible-history')
    await request.delete('/api/bible-bookmarks')
  })

  test.afterAll(async ({ request }) => {
    await setAutoPresent(request, false)
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

  test('with "present as soon as I pick it" on, a single click shows the verse', async ({
    page,
    request,
  }) => {
    await setAutoPresent(request, false)
    await request.post('/api/bible-history', { data: HISTORY_VERSE })
    await openBibleWithPanel(page, 'history')

    const menu = await openActionsMenu(page, 'bible-preview-settings')
    const toggle = menu.getByTestId('bible-preview-auto-present')
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await toggle.click()
    await expect
      .poll(async () => {
        const res = await request.get(
          '/api/settings/app_settings/bible_auto_present_on_select',
        )
        return (await res.json())?.data?.value
      })
      .toBe('true')
    await page.keyboard.press('Escape')

    await page.getByTestId('bible-history-item').first().click()
    await expect.poll(() => presentedReference(request)).toBe('Ioan 3:16')
  })

  test('the hidden screen offers "Show on screen", with a tooltip saying what it does', async ({
    page,
    request,
  }) => {
    await setAutoPresent(request, false)
    await request.post('/api/bible-history', { data: HISTORY_VERSE })
    await openBibleWithPanel(page, 'history')
    await page.getByTestId('bible-history-item').first().dblclick()
    await expect.poll(() => presentedReference(request)).toBe('Ioan 3:16')

    await page.keyboard.press('Escape')
    const show = page.getByRole('button', { name: 'Afișează pe ecran' })
    await expect(show).toBeVisible()
    await expect(show).toHaveAttribute(
      'title',
      'Trimite pe proiector și pe celelalte ecrane ceea ce vezi în previzualizare',
    )
  })
})
