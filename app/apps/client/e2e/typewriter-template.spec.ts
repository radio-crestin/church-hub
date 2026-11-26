import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { label } from './helpers/background-media'

/**
 * The typewriter text animation: a template whose verse comes in "typed"
 * types it in, left to right, on the projector and in the operator's live
 * preview; a new slide starts typing from the beginning, the slide it replaced
 * leaves whole. Thumbnails, and a preview for an operator who asked for less
 * motion, show the finished text at once.
 */

const VERSES = [
  'Fiindcă atât de mult a iubit Dumnezeu lumea, că a dat pe singurul Lui Fiu, pentru ca oricine crede în El să nu piară, ci să aibă viața veșnică.',
  'Dumnezeu, în adevăr, n-a trimis pe Fiul Său în lume ca să judece lumea, ci ca lumea să fie mântuită prin El.',
]
/** The bundled typewriter themes type a verse in at most 3.5 s. */
const LONGEST_TYPING_MS = 3500

interface Template {
  id: number
  bundledKey: string | null
}

async function typewriterTemplate(request: APIRequestContext) {
  const all = (await (await request.get('/api/slide-templates')).json())
    .data as Template[]
  return all.find((t) => t.bundledKey === 'typewriter_paper') as Template
}

async function typewriterScreen(
  request: APIRequestContext,
  extra: Record<string, unknown> = {},
): Promise<number> {
  const name = `E2E Typewriter ${Date.now()}`
  const created = await request.post('/api/screens', {
    data: { name, type: 'primary' },
  })
  expect(created.ok()).toBe(true)
  const id = (await created.json()).data.id as number
  const template = await typewriterTemplate(request)
  const saved = await request.post('/api/screens', {
    data: { id, name, type: 'primary', templateId: template.id, ...extra },
  })
  expect(saved.ok()).toBe(true)
  return id
}

function presentVerse(request: APIRequestContext, index: number) {
  return request.post('/api/presentation/temporary-bible', {
    data: {
      verseId: 9100 + index,
      reference: `Ioan 3:${16 + index}`,
      text: VERSES[index],
      translationAbbreviation: 'VDC',
      bookName: 'Ioan',
      translationId: 1,
      bookId: 43,
      bookCode: 'JHN',
      chapter: 3,
      currentVerseIndex: 15 + index,
    },
  })
}

/** One frame of a text being typed. */
interface Frame {
  at: number
  /** Characters of the entering text that show; -1 while it isn't drawn. */
  shown: number
  length: number
  caret: boolean
  /** The slide leaving under it shows all its words (true when none leaves). */
  leavingWhole: boolean
}

/**
 * Samples every frame from before `action` runs until the text containing
 * `text` (inside `root`) has shown whole for 20 frames, or 10 s.
 */
async function sampleTyping(
  page: Page,
  root: string,
  text: string,
  action: () => Promise<unknown>,
): Promise<Frame[]> {
  await page.evaluate(
    ({ root, text }) =>
      new Promise<void>((started) => {
        const shownText = (anchor: Element) => {
          const walker = document.createTreeWalker(anchor, NodeFilter.SHOW_TEXT)
          let shown = ''
          while (walker.nextNode()) {
            const node = walker.currentNode as Text
            if (!node.parentElement?.closest('[data-typewriter-hidden]')) {
              shown += node.data
            }
          }
          return shown
        }
        const anchors = () => [
          ...document.querySelectorAll(`${root} [data-style-anchor]`),
        ]
        const frames: Frame[] = []
        let wholeFrames = 0
        const startedAt = performance.now()
        ;(window as unknown as { __frames: Promise<Frame[]> }).__frames =
          new Promise((resolve) => {
            const sample = () => {
              const entering = anchors().find(
                (a) =>
                  !a.closest('[data-leaving]') && a.textContent?.includes(text),
              )
              const leaving = anchors().filter((a) =>
                a.closest('[data-leaving]'),
              )
              const length = entering?.textContent?.length ?? 0
              const shown = entering ? shownText(entering).length : -1
              frames.push({
                at: performance.now() - startedAt,
                shown,
                length,
                caret: !!entering?.querySelector('[data-typewriter-caret]'),
                leavingWhole: leaving.every(
                  (a) => shownText(a) === a.textContent,
                ),
              })
              wholeFrames = shown === length && length > 0 ? wholeFrames + 1 : 0
              if (wholeFrames >= 20 || performance.now() - startedAt > 10_000) {
                resolve(frames)
              } else requestAnimationFrame(sample)
            }
            sample()
            started()
          })
      }),
    { root, text },
  )
  await action()
  return page.evaluate(
    () => (window as unknown as { __frames: Promise<Frame[]> }).__frames,
  )
}

/** How much of the (not leaving) text containing `text` shows: 0 to 1. */
function typedPart(page: Page, text: string): Promise<number> {
  return page.evaluate((text) => {
    const anchor = [...document.querySelectorAll('[data-style-anchor]')].find(
      (a) => !a.closest('[data-leaving]') && a.textContent?.includes(text),
    )
    if (!anchor?.textContent) return 0
    const hidden = [...anchor.querySelectorAll('[data-typewriter-hidden]')]
      .map((element) => element.textContent?.length ?? 0)
      .reduce((sum, length) => sum + length, 0)
    return 1 - hidden / anchor.textContent.length
  }, text)
}

const isPartial = (frame: Frame) =>
  frame.shown > 0 && frame.shown < frame.length

/** How long the text took from first drawn to whole. */
function typingTime(frames: Frame[]): number {
  const first = frames.find((frame) => frame.shown >= 0) as Frame
  const whole = frames.find(
    (frame) => frame.length > 0 && frame.shown === frame.length,
  ) as Frame
  return whole.at - first.at
}

/** Records, from the page's first script, whether any text ever typed. */
async function watchForTyping(page: Page) {
  await page.addInitScript(() => {
    const flag = window as unknown as { __typed: boolean }
    flag.__typed = false
    new MutationObserver(() => {
      if (document.querySelector('[data-typewriter-hidden]')) {
        flag.__typed = true
      }
    }).observe(document, { childList: true, subtree: true })
  })
}

const typedSoFar = (page: Page) =>
  page.evaluate(() => (window as unknown as { __typed: boolean }).__typed)

test.describe('Typewriter template', () => {
  const screens: number[] = []

  test.afterAll(async ({ request }) => {
    await request.post('/api/presentation/stop').catch(() => {})
    for (const id of screens) {
      await request.delete(`/api/screens/${id}`).catch(() => {})
    }
  })

  test('the projector types a verse in, then shows it whole', async ({
    page,
    request,
  }) => {
    const screenId = await typewriterScreen(request)
    screens.push(screenId)
    await request.post('/api/presentation/stop')
    await page.goto(`/screen/${screenId}`)
    await expect(page.locator('[data-style-anchor]')).toHaveCount(0)

    const frames = await sampleTyping(page, 'body', VERSES[0], async () =>
      expect((await presentVerse(request, 0)).ok()).toBeTruthy(),
    )

    expect(frames.some(isPartial), 'part of the verse shows first').toBe(true)
    expect(
      frames.some((frame) => isPartial(frame) && frame.caret),
      'a caret follows the typing',
    ).toBe(true)
    expect(frames.at(-1)?.shown).toBe(frames.at(-1)?.length)
    expect(frames.at(-1)?.caret).toBe(false)
    expect(typingTime(frames)).toBeLessThan(LONGEST_TYPING_MS + 1000)
    await expect(page.getByText(VERSES[0]).last()).toBeVisible()
  })

  test('a new slide mid-typing types from the start, the old one leaves whole', async ({
    page,
    request,
  }) => {
    const screenId = await typewriterScreen(request)
    screens.push(screenId)
    await request.post('/api/presentation/stop')
    await page.goto(`/screen/${screenId}`)
    await expect(page.locator('[data-style-anchor]')).toHaveCount(0)

    // The first verse is still typing when the second one is sent.
    const frames = await sampleTyping(page, 'body', VERSES[1], async () => {
      expect((await presentVerse(request, 0)).ok()).toBeTruthy()
      await expect
        .poll(() => typedPart(page, VERSES[0]), { intervals: [50] })
        .toBeGreaterThan(0.2)
      expect(await typedPart(page, VERSES[0])).toBeLessThan(1)
      expect((await presentVerse(request, 1)).ok()).toBeTruthy()
    })

    const drawn = frames.filter((frame) => frame.shown >= 0)
    expect(drawn.length).toBeGreaterThan(0)
    expect(
      drawn[0].shown,
      'the new verse starts from its first characters',
    ).toBeLessThan(drawn[0].length / 4)
    expect(drawn.some(isPartial)).toBe(true)
    expect(
      frames.every((frame) => frame.leavingWhole),
      'the verse it replaced leaves whole',
    ).toBe(true)
    expect(drawn.at(-1)?.shown).toBe(drawn.at(-1)?.length)
    await expect(page.getByText(VERSES[0])).toHaveCount(0)
  })

  test("a theme's thumbnail shows its sample verse whole", async ({
    page,
    request,
  }) => {
    const template = await typewriterTemplate(request)
    await watchForTyping(page)
    await page.goto('/settings/themes')
    const thumbnail = page
      .locator(
        `[data-testid="template-card"][data-template-id="${template.id}"]`,
      )
      .getByTestId('template-thumbnail')
    await expect(
      thumbnail
        .locator('[data-style-anchor]')
        .filter({ hasText: label('presentation', 'templates.sample.verse') }),
    ).toBeVisible()
    // Long enough for a typing to have started, had it been going to.
    await page.waitForTimeout(500)
    expect(await typedSoFar(page)).toBe(false)
  })

  test('the live preview types like the screen, but not for less motion', async ({
    page,
    request,
  }) => {
    const screenId = await typewriterScreen(request, { isPreviewScreen: true })
    screens.push(screenId)
    await request.post('/api/presentation/stop')

    const preview = page.getByTestId('live-preview')
    await page.goto('/present')
    await expect(preview).toBeVisible({ timeout: 15000 })
    const frames = await sampleTyping(
      page,
      '[data-testid="live-preview"]',
      VERSES[0],
      async () => expect((await presentVerse(request, 0)).ok()).toBeTruthy(),
    )
    expect(frames.some(isPartial), 'the preview types the verse').toBe(true)
    expect(frames.at(-1)?.shown).toBe(frames.at(-1)?.length)

    // An operator who asked their system for less motion reads it at once.
    await request.post('/api/presentation/stop')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await watchForTyping(page)
    await page.reload()
    await expect(preview).toBeVisible({ timeout: 15000 })
    expect((await presentVerse(request, 1)).ok()).toBeTruthy()
    await expect(preview).toContainText(VERSES[1])
    await page.waitForTimeout(500)
    expect(await typedSoFar(page)).toBe(false)
  })
})
