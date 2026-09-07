import { expect, type Page, test } from '@playwright/test'

/**
 * The size box on the stage formatting bar, PowerPoint's way round: it reports
 * the size of what is selected, says so when the selection is mixed rather than
 * picking one of the sizes, and applies what is typed (or picked) to the whole
 * selection.
 */

const LINES = ['Prima linie', 'A doua linie']
const SLIDE_TEXT = LINES.join('\n')

async function selectInEditor(page: Page, text: string) {
  await page.getByTestId('slide-canvas-editable').evaluate((editor, needle) => {
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node && !node.textContent?.includes(needle)) {
      node = walker.nextNode()
    }
    if (!node?.textContent) throw new Error(`"${needle}" is not in the editor`)
    const at = node.textContent.indexOf(needle)
    const range = document.createRange()
    range.setStart(node, at)
    range.setEnd(node, at + needle.length)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  }, text)
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

test.describe('Font size box', () => {
  let songId: number

  test.beforeEach(async ({ page, request }) => {
    const response = await request.post('/api/songs', {
      data: {
        title: `E2E Font Field ${Date.now()}`,
        slides: [{ content: SLIDE_TEXT, sortOrder: 0 }],
      },
    })
    expect(response.status()).toBe(201)
    songId = (await response.json()).data.id

    await page.addInitScript(() => {
      window.localStorage.setItem('song-editor-layout', 'powerpoint')
    })
    await page.goto(`/songs/${songId}`)
    await page.waitForLoadState('networkidle')

    const stage = page.locator('[data-editing]')
    await expect(stage).toContainText(LINES[0], { timeout: 10000 })
    await stage.click()
    await expect(page.getByTestId('slide-style-toolbar')).toBeVisible()
  })

  test.afterEach(async ({ request }) => {
    await request.delete(`/api/songs/${songId}`)
  })

  test('reports one size for a uniform selection and marks a mixed one', async ({
    page,
  }) => {
    const field = page.getByTestId('slide-style-font-size')

    await selectAllInEditor(page)
    await expect.poll(async () => await field.inputValue()).toMatch(/^\d+$/)
    const uniform = Number.parseInt(await field.inputValue(), 10)
    expect(uniform).toBeGreaterThan(0)

    // Shrink one word so the slide holds two sizes. Shrinking, never growing:
    // A+ is disabled once the text already fills its box.
    await selectInEditor(page, 'doua')
    await page.getByTestId('slide-style-font-decrease').click()
    // Wait for the size to actually come down: the box reports what the canvas
    // renders, and the fit settles a frame after the click.
    await expect
      .poll(async () => Number.parseInt(await field.inputValue(), 10), {
        timeout: 5000,
      })
      .toBeLessThan(uniform)
    const smaller = Number.parseInt(await field.inputValue(), 10)

    // Now the whole slide is mixed, and the box says the smallest, with a `+`.
    await selectAllInEditor(page)
    await expect
      .poll(async () => await field.inputValue(), { timeout: 5000 })
      .toBe(`${smaller}+`)
  })

  test('a typed size lands on the whole selection', async ({
    page,
    request,
  }) => {
    const field = page.getByTestId('slide-style-font-size')

    // Make the slide mixed first, so the change has to flatten it.
    await selectInEditor(page, 'doua')
    await page.getByTestId('slide-style-font-decrease').click()
    await selectAllInEditor(page)
    await expect
      .poll(async () => await field.inputValue(), { timeout: 5000 })
      .toMatch(/\+$/)

    await field.click()
    await field.fill('24')
    await field.press('Enter')

    // One run covering everything, so the box has a single size to report.
    await expect
      .poll(
        async () => {
          const response = await request.get(`/api/songs/${songId}`)
          const { data } = await response.json()
          return data.slides[0].styleOverrides?.ranges ?? []
        },
        { timeout: 10000 },
      )
      .toEqual([expect.objectContaining({ start: 0, end: SLIDE_TEXT.length })])
    await expect
      .poll(async () => await field.inputValue(), { timeout: 5000 })
      .toMatch(/^\d+$/)
  })

  test('the list offers the usual sizes and applies the one picked', async ({
    page,
    request,
  }) => {
    const field = page.getByTestId('slide-style-font-size')
    await selectInEditor(page, 'Prima')
    await expect.poll(async () => await field.inputValue()).toMatch(/^\d+$/)
    const current = Number.parseInt(await field.inputValue(), 10)
    // Growing is capped at the edge of the slide, and how much room is left
    // depends on the machine's fonts — so pick a preset below the current size,
    // which is always applicable.
    const smaller = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40]
      .filter((size) => size < current)
      .pop()
    expect(smaller).toBeDefined()

    await page.getByTestId('slide-style-font-size-menu').click()

    const list = page.getByTestId('slide-style-font-size-list')
    await expect(list).toBeVisible()
    await expect(page.getByTestId('slide-style-font-size-8')).toBeVisible()
    await expect(page.getByTestId('slide-style-font-size-72')).toBeVisible()

    await page.getByTestId(`slide-style-font-size-${smaller}`).click()
    await expect(list).toBeHidden()

    await expect
      .poll(
        async () => {
          const response = await request.get(`/api/songs/${songId}`)
          const { data } = await response.json()
          return data.slides[0].styleOverrides?.ranges ?? []
        },
        { timeout: 10000 },
      )
      .toEqual([expect.objectContaining({ start: 0, end: 'Prima'.length })])
  })
})
