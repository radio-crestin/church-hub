import { expect, type Page, test } from '@playwright/test'

/**
 * "Auto-correct" on the stage formatting bar: proof-reads the selected verses
 * through the same AI provider the song search is configured with — missing
 * Romanian diacritics, obvious misspellings, capitalisation, proper names —
 * without rewriting the poetry or restructuring the lines.
 *
 * The test database has no AI provider configured, which is what the failure
 * path here checks; the correction itself is covered by the parser's unit
 * tests, which are what guard the "same number of lines" contract.
 */

async function openStage(page: Page, songId: number, firstLine: string) {
  await page.addInitScript(() => {
    window.localStorage.setItem('song-editor-layout', 'powerpoint')
  })
  await page.goto(`/songs/${songId}`)
  await page.waitForLoadState('networkidle')
  const stage = page.locator('[data-editing]')
  await expect(stage).toContainText(firstLine, { timeout: 10000 })
  await stage.click()
  await expect(page.getByTestId('slide-style-toolbar')).toBeVisible()
}

async function selectAllInEditor(page: Page) {
  await page.getByTestId('slide-canvas-editable').evaluate((editor) => {
    const range = document.createRange()
    range.selectNodeContents(editor)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })
}

test.describe('Auto-correct the selected lyrics', () => {
  test('the endpoint refuses an empty passage', async ({ request }) => {
    const response = await request.post('/api/songs/correct-lyrics', {
      data: { text: '   ' },
    })
    expect(response.status()).toBe(400)
    expect((await response.json()).error).toContain('required')
  })

  test('the endpoint says so when no AI provider is configured', async ({
    request,
  }) => {
    const response = await request.post('/api/songs/correct-lyrics', {
      data: { text: 'E o noua zi, soarele rasare' },
    })
    expect(response.status()).toBe(500)
    expect((await response.json()).error).toContain('AI is not configured')
  })

  test('the button waits for a selection, then reports what went wrong', async ({
    page,
    request,
  }) => {
    const created = await request.post('/api/songs', {
      data: {
        title: `E2E Correct ${Date.now()}`,
        slides: [{ content: 'E o noua zi, soarele rasare', sortOrder: 0 }],
      },
    })
    expect(created.status()).toBe(201)
    const songId = (await created.json()).data.id as number

    try {
      await openStage(page, songId, 'E o noua zi')

      // Correcting is a selection action, like the case menu beside it.
      const correct = page.getByTestId('slide-style-correct')
      await expect(correct).toBeDisabled()

      await selectAllInEditor(page)
      await expect(correct).toBeEnabled()
      await correct.click()

      // No provider is configured here, and the operator is told rather than
      // left watching a button that did nothing.
      await expect(page.getByText('AI is not configured')).toBeVisible({
        timeout: 10000,
      })
      // The verses are untouched by a correction that could not run.
      await expect
        .poll(async () => {
          const response = await request.get(`/api/songs/${songId}`)
          const { data } = await response.json()
          return data.slides[0].content as string
        })
        .toContain('E o noua zi, soarele rasare')
    } finally {
      await request.delete(`/api/songs/${songId}`)
    }
  })
})
