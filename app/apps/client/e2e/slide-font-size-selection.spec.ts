import { expect, type Page, test } from '@playwright/test'

/**
 * Resizing the font of a *selection* on the stage.
 *
 * Style runs are stored as character offsets into the slide's plain text, and
 * the editor is seeded two different ways: plain text through `innerText`,
 * where every line break becomes a `<br>` element holding no characters, and
 * styled text as markup, where the same break stays a real `\n`. Reading the
 * selection over text nodes alone therefore answered short by one per line
 * break before it — so the run landed shifted and its last characters, one per
 * line the selection spanned, never got the new size.
 *
 * These hold the offsets to the text the projector actually lays out.
 */

const LINES = ['Prima linie', 'A doua linie', 'A treia linie']
const SLIDE_TEXT = LINES.join('\n')
// "Prima linie\nA doua linie\nA treia linie"
const LAST_LINE_START = LINES[0].length + 1 + LINES[1].length + 1
const TEXT_LENGTH = SLIDE_TEXT.length

/** Selects `text` inside the stage editor, exactly as a mouse drag would. */
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

/** Selects everything in the stage editor, boundaries on the element itself. */
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

test.describe.configure({ mode: 'serial' })

test.describe('Font size on a selection', () => {
  let songId: number

  test.beforeEach(async ({ page, request }) => {
    const response = await request.post('/api/songs', {
      data: {
        title: `E2E Font Range ${Date.now()}`,
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

  /** The style runs the server has for the slide. */
  async function storedRanges(request: {
    get: (url: string) => Promise<{ json: () => Promise<unknown> }>
  }) {
    const response = await request.get(`/api/songs/${songId}`)
    const { data } = (await response.json()) as {
      data: {
        slides: Array<{
          styleOverrides: {
            ranges?: Array<{ start: number; end: number }>
          } | null
        }>
      }
    }
    return data.slides[0].styleOverrides?.ranges ?? []
  }

  test('a selection on the last line is styled to its last character', async ({
    page,
    request,
  }) => {
    await selectInEditor(page, LINES[2])
    // Shrinking, never growing: A+ is disabled once the text already fills its
    // box, which depends on the machine's fonts.
    await page.getByTestId('slide-style-font-decrease').click()

    await expect
      .poll(async () => await storedRanges(request), { timeout: 10000 })
      .toEqual([
        expect.objectContaining({
          start: LAST_LINE_START,
          end: TEXT_LENGTH,
        }),
      ])
  })

  test('a selection ending mid-word stops exactly there', async ({
    page,
    request,
  }) => {
    await selectInEditor(page, 'A tre')
    await page.getByTestId('slide-style-font-decrease').click()

    await expect
      .poll(async () => await storedRanges(request), { timeout: 10000 })
      .toEqual([
        expect.objectContaining({
          start: LAST_LINE_START,
          end: LAST_LINE_START + 'A tre'.length,
        }),
      ])
  })

  test('selecting the whole slide covers every line, breaks included', async ({
    page,
    request,
  }) => {
    await selectAllInEditor(page)
    await page.getByTestId('slide-style-font-decrease').click()

    await expect
      .poll(async () => await storedRanges(request), { timeout: 10000 })
      .toEqual([expect.objectContaining({ start: 0, end: TEXT_LENGTH })])
  })

  test('a selection spanning two lines keeps its tail', async ({
    page,
    request,
  }) => {
    await page.getByTestId('slide-canvas-editable').evaluate(
      (editor, { from, to }) => {
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
        const nodes: Text[] = []
        let node = walker.nextNode() as Text | null
        while (node) {
          nodes.push(node)
          node = walker.nextNode() as Text | null
        }
        const locate = (target: string, index: number) => {
          for (const candidate of nodes) {
            const at = candidate.data.indexOf(target)
            if (at !== -1) return { node: candidate, offset: at + index }
          }
          throw new Error(`"${target}" is not in the editor`)
        }
        const start = locate(from, 0)
        const end = locate(to, to.length)
        const range = document.createRange()
        range.setStart(start.node, start.offset)
        range.setEnd(end.node, end.offset)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
        document.dispatchEvent(new Event('selectionchange'))
      },
      { from: 'doua', to: 'treia' },
    )
    await page.getByTestId('slide-style-font-decrease').click()

    const expectedStart = LINES[0].length + 1 + LINES[1].indexOf('doua')
    const expectedEnd =
      LAST_LINE_START + LINES[2].indexOf('treia') + 'treia'.length
    await expect
      .poll(async () => await storedRanges(request), { timeout: 10000 })
      .toEqual([
        expect.objectContaining({ start: expectedStart, end: expectedEnd }),
      ])
  })
})
