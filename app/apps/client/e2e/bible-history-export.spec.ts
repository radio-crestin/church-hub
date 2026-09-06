import { readFile } from 'node:fs/promises'
import { expect, type Page, test } from '@playwright/test'

/**
 * Bible history export: the download button offers two scopes — the last
 * session, or the entire history — and each writes a schedule text file.
 *
 * Serial, because every test here writes to the one global history list.
 */
test.describe('Bible history export', () => {
  test.describe.configure({ mode: 'serial' })

  const VERSES = [
    {
      verseId: 900001,
      reference: 'Ioan 3:16 - VDCC',
      text: 'Fiindca atat de mult a iubit Dumnezeu lumea',
      translationAbbreviation: 'VDCC',
      bookName: 'Ioan',
      translationId: 1,
      bookId: 43,
      chapter: 3,
      verse: 16,
    },
    {
      verseId: 900002,
      reference: 'Psalmi 23:1 - VDCC',
      text: 'Domnul este Pastorul meu',
      translationAbbreviation: 'VDCC',
      bookName: 'Psalmi',
      translationId: 1,
      bookId: 19,
      chapter: 23,
      verse: 1,
    },
  ]

  /** Empties the history, then adds the two verses above. */
  async function seedHistory(page: Page) {
    await page.request.delete('/api/bible-history').catch(() => {})
    for (const verse of VERSES) {
      await page.request.post('/api/bible-history', { data: verse })
    }
  }

  /** Opens /bible with the Istoric panel already expanded. */
  async function openBibleWithHistory(page: Page) {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('bible:history-open', 'true')
    })
    await page.goto('/bible')
    await expect(page.getByTestId('bible-history-export')).toBeVisible({
      timeout: 15000,
    })
  }

  /** Clicks a menu entry and returns the text of the file it downloads. */
  async function exportAndRead(page: Page, testId: string) {
    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId(testId).click()
    const download = await downloadPromise
    const path = await download.path()
    return {
      filename: download.suggestedFilename(),
      content: await readFile(path, 'utf8'),
    }
  }

  test.beforeEach(async ({ page }) => {
    await seedHistory(page)
  })

  test.afterAll(async ({ request }) => {
    await request.delete('/api/bible-history').catch(() => {})
  })

  test('the export button offers both scopes with their verse counts', async ({
    page,
  }) => {
    await openBibleWithHistory(page)

    const trigger = page.getByTestId('bible-history-export')
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await trigger.click()

    const menu = page.getByTestId('bible-history-export-menu')
    await expect(menu).toBeVisible()
    // Both verses were just added, so both scopes cover the same two verses.
    await expect(
      page.getByTestId('bible-history-export-session'),
    ).toContainText('2')
    await expect(page.getByTestId('bible-history-export-all')).toContainText(
      '2',
    )

    // Escape puts the menu away again.
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  test('exporting the entire history downloads every verse as a schedule', async ({
    page,
  }) => {
    await openBibleWithHistory(page)
    await page.getByTestId('bible-history-export').click()

    const { filename, content } = await exportAndRead(
      page,
      'bible-history-export-all',
    )

    expect(filename).toMatch(/^bible-history-\d{4}-\d{2}-\d{2}\.schedule\.txt$/)
    // References lose their translation suffix so the schedule parser reads
    // them, and each verse's text follows as a comment.
    expect(content).toContain('Ioan 3:16 [V]')
    expect(content).toContain('Psalmi 23:1 [V]')
    expect(content).toContain('# Domnul este Pastorul meu')
    expect(content).not.toContain('Ioan 3:16 - VDCC [V]')

    // The menu closes once a scope is picked.
    await expect(page.getByTestId('bible-history-export-menu')).toBeHidden()
  })

  test('exporting the last session downloads its own file', async ({
    page,
  }) => {
    await openBibleWithHistory(page)
    await page.getByTestId('bible-history-export').click()

    const { filename, content } = await exportAndRead(
      page,
      'bible-history-export-session',
    )

    expect(filename).toMatch(
      /^bible-history-session-\d{4}-\d{2}-\d{2}\.schedule\.txt$/,
    )
    // Everything was added moments ago, so the session holds both verses.
    expect(content).toContain('Ioan 3:16 [V]')
    expect(content).toContain('Psalmi 23:1 [V]')
  })

  test('the menu offers nothing to export once the history is cleared', async ({
    page,
  }) => {
    await openBibleWithHistory(page)

    await page.request.delete('/api/bible-history')
    await page.reload()

    // With an empty history the header drops its actions entirely.
    await expect(page.getByTestId('bible-history-export')).toBeHidden({
      timeout: 15000,
    })
  })
})
