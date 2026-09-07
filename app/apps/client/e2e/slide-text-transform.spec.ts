import { expect, type Page, test } from '@playwright/test'

/**
 * "Change case" on the stage formatting bar: re-cases exactly what is selected
 * and nothing else, and leaves the slide's own styling on the words it was put
 * on — every transform keeps the text the same length, which is what the style
 * runs' offsets depend on.
 */

/** The canvas text with its line breaks intact — `toHaveText` folds them away. */
async function slideText(page: Page): Promise<string> {
  return page
    .getByTestId('slide-canvas-editable')
    .evaluate((editor) => (editor as HTMLElement).innerText.replace(/\n$/, ''))
}

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

async function chooseTransform(page: Page, id: string) {
  await page.getByTestId('slide-style-transform-menu').click()
  await expect(page.getByTestId('slide-style-transform-list')).toBeVisible()
  await page.getByTestId(`slide-style-transform-${id}`).click()
  await expect(page.getByTestId('slide-style-transform-list')).toBeHidden()
}

test.describe('Change case on a selection', () => {
  test('a shouted line becomes a sentence', async ({ page, request }) => {
    const response = await request.post('/api/songs', {
      data: {
        title: `E2E Case Sentence ${Date.now()}`,
        slides: [{ content: 'ACESTA ESTE UN TEXT', sortOrder: 0 }],
      },
    })
    expect(response.status()).toBe(201)
    const songId = (await response.json()).data.id as number

    try {
      await openStage(page, songId, 'ACESTA ESTE UN TEXT')
      await selectAllInEditor(page)
      await chooseTransform(page, 'sentence')

      await expect
        .poll(async () => await slideText(page))
        .toBe('Acesta este un text')
      await expect
        .poll(
          async () => {
            const res = await request.get(`/api/songs/${songId}`)
            const { data } = await res.json()
            return data.slides[0].content as string
          },
          { timeout: 10000 },
        )
        .toContain('Acesta este un text')
    } finally {
      await request.delete(`/api/songs/${songId}`)
    }
  })

  test('each line gets its own capital', async ({ page, request }) => {
    const response = await request.post('/api/songs', {
      data: {
        title: `E2E Case Lines ${Date.now()}`,
        slides: [{ content: 'PRIMUL rând\nAL DOILEA RÂND', sortOrder: 0 }],
      },
    })
    expect(response.status()).toBe(201)
    const songId = (await response.json()).data.id as number

    try {
      await openStage(page, songId, 'PRIMUL')
      await selectAllInEditor(page)
      await chooseTransform(page, 'lineStart')

      await expect
        .poll(async () => await slideText(page))
        .toBe('Primul rând\nAl doilea rând')
    } finally {
      await request.delete(`/api/songs/${songId}`)
    }
  })

  test('only the selected words change', async ({ page, request }) => {
    const response = await request.post('/api/songs', {
      data: {
        title: `E2E Case Partial ${Date.now()}`,
        slides: [{ content: 'prima linie\na doua linie', sortOrder: 0 }],
      },
    })
    expect(response.status()).toBe(201)
    const songId = (await response.json()).data.id as number

    try {
      await openStage(page, songId, 'prima linie')
      await selectInEditor(page, 'a doua')
      await chooseTransform(page, 'upper')

      await expect
        .poll(async () => await slideText(page))
        .toBe('prima linie\nA DOUA linie')
    } finally {
      await request.delete(`/api/songs/${songId}`)
    }
  })

  test('the menu is out of reach until something is selected', async ({
    page,
    request,
  }) => {
    const response = await request.post('/api/songs', {
      data: {
        title: `E2E Case Disabled ${Date.now()}`,
        slides: [{ content: 'prima linie', sortOrder: 0 }],
      },
    })
    expect(response.status()).toBe(201)
    const songId = (await response.json()).data.id as number

    try {
      await openStage(page, songId, 'prima linie')
      await expect(
        page.getByTestId('slide-style-transform-menu'),
      ).toBeDisabled()
    } finally {
      await request.delete(`/api/songs/${songId}`)
    }
  })

  test('the styling put on a word survives the re-casing', async ({
    page,
    request,
  }) => {
    const response = await request.post('/api/songs', {
      data: {
        title: `E2E Case Keeps Style ${Date.now()}`,
        slides: [{ content: 'prima linie\na doua linie', sortOrder: 0 }],
      },
    })
    expect(response.status()).toBe(201)
    const songId = (await response.json()).data.id as number

    const storedRanges = async () => {
      const res = await request.get(`/api/songs/${songId}`)
      const { data } = await res.json()
      return data.slides[0].styleOverrides?.ranges ?? []
    }

    try {
      await openStage(page, songId, 'prima linie')

      // Shrink one word, so the slide carries a run at fixed offsets.
      await selectInEditor(page, 'doua')
      await page.getByTestId('slide-style-font-decrease').click()
      await expect.poll(storedRanges, { timeout: 10000 }).toHaveLength(1)
      const before = await storedRanges()

      // Re-case the whole slide. The transform keeps the text exactly as long,
      // so the run still covers the same word.
      await selectAllInEditor(page)
      await chooseTransform(page, 'upper')
      await expect
        .poll(async () => await slideText(page))
        .toBe('PRIMA LINIE\nA DOUA LINIE')

      await expect.poll(storedRanges, { timeout: 10000 }).toEqual(before)
    } finally {
      await request.delete(`/api/songs/${songId}`)
    }
  })
})
