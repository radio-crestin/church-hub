import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * The Control Room preview is a scaled copy of the projection: the same words,
 * broken into the same lines, at the same size relative to their box, and all
 * of them in view. On the macOS desktop app (WebKit) the preview's box grew
 * past its frame and cut the last lines off; the configured "Amin" label only
 * reached the screens whose settings happened to load before the slide; and a
 * small preview fitted its text in whole pixels against a whole-pixel height,
 * several percent off the projection. The screen settings and the presentation
 * state are rewritten in the browser only, so nothing here changes the real
 * screens or what is live.
 */

const AMEN_LABEL = 'AMIN'
const LAST_SLIDE_LINES = [
  'Cor: /: Îţi mulţumim, Îţi mulţumim, Părinte veşnic şi divin',
  'Căci Tu ne dai iar noi primim',
  'Îţi mulţumim, Îţi mulţumim',
  'Acum şi-n veci de veci, amin. :/',
  'Căci Tu prin harul minunat mereu ne-ai binecuvântat',
  'Amin',
]
const FIRST_LYRIC = 'Căci Tu ne dai iar noi primim'
const TIME_TEXT = /^\d{1,2}:\d{2}(:\d{2})?$/
/** How late the screen settings arrive after the presentation state. */
const SCREEN_SETTINGS_DELAY_MS = 1000

interface PreviewScreen {
  id: number
  type: string
  isPreviewScreen: boolean
  sortOrder: number
  width: number
  height: number
}

/** One text element as drawn, measured against its own box. */
interface DrawnText {
  text: string
  lines: number
  /** Font size as a share of the box width, which scales with the screen. */
  fontShare: number
  /** Words that fall outside what the page leaves visible. */
  hiddenWords: number
}

/** Same choice LivePreview makes: the flagged preview screen, else the first primary. */
async function getPreviewScreen(
  request: APIRequestContext,
): Promise<PreviewScreen> {
  const response = await request.get('/api/screens')
  expect(response.ok()).toBeTruthy()
  const screens: PreviewScreen[] = (await response.json()).data
  const screen =
    screens.find((s) => s.isPreviewScreen) ??
    screens
      .filter((s) => s.type === 'primary')
      .sort((a, b) => a.sortOrder - b.sortOrder)[0]
  expect(screen, 'a preview screen exists').toBeTruthy()
  return screen
}

/**
 * Serves the screen with a custom "Amin" label, without chords and without
 * the next-slide section (the projection would draw it, the preview never
 * does). The settings arrive after the presentation state — the order the
 * previews always get them in, since they look the screen up in the screen
 * list first.
 */
async function serveScreen(page: Page, screenId: number) {
  await page.route(`**/api/screens/${screenId}`, async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const response = await route.fetch()
    const body = await response.json()
    const screen = body.data
    const song = screen.contentConfigs.song
    const lastSlide = screen.contentConfigs.song_last_slide
    song.displayChords = false
    lastSlide.mainText.hidden = false
    lastSlide.amen = { ...lastSlide.amen, hidden: false, text: AMEN_LABEL }
    if (screen.nextSlideConfig) {
      screen.nextSlideConfig = { ...screen.nextSlideConfig, enabled: false }
    }
    await new Promise((resolve) =>
      setTimeout(resolve, SCREEN_SETTINGS_DELAY_MS),
    )
    await route.fulfill({ response, json: body })
  })
}

/**
 * Serves a presentation state with the last slide of a song on screen. Writes
 * are refused, so nothing the page does reaches the live presentation.
 */
async function servePresentation(page: Page) {
  await page.route('**/api/presentation/**', async (route) => {
    const request = route.request()
    if (request.method() !== 'GET') return route.abort()
    if (!new URL(request.url()).pathname.endsWith('/presentation/state')) {
      return route.continue()
    }
    const response = await route.fetch()
    const body = await response.json()
    body.data = {
      ...body.data,
      currentSongSlideId: null,
      lastSongSlideId: null,
      isPresenting: true,
      isHidden: false,
      slideHighlights: [],
      temporaryContent: {
        type: 'song',
        data: {
          songId: 1,
          title: 'E2E Preview Song',
          keyLine: null,
          slides: [
            { id: 1, sortOrder: 0, content: '<p>First</p>' },
            { id: 2, sortOrder: 1, content: '<p>Middle</p>' },
            {
              id: 3,
              sortOrder: 2,
              content: LAST_SLIDE_LINES.map((line) => `<p>${line}</p>`).join(
                '',
              ),
            },
          ],
          currentSlideIndex: 2,
        },
      },
      // Newer than anything the server broadcasts, so the live state the
      // WebSocket sends never replaces this one.
      updatedAt: Date.now() + 10 ** 10,
    }
    await route.fulfill({ response, json: body })
  })
}

/** Every text element drawn inside `rootSelector`, clocks left out. */
function readTexts(page: Page, rootSelector: string): Promise<DrawnText[]> {
  return page.evaluate(
    ({ rootSelector, timePattern }) => {
      const root = document.querySelector(rootSelector)
      if (!root) return []
      const time = new RegExp(timePattern)

      // What is left visible of a box once every clipping ancestor and the
      // viewport have had their say.
      const visibleArea = (element: HTMLElement) => {
        const area = {
          left: 0,
          top: 0,
          right: window.innerWidth,
          bottom: window.innerHeight,
        }
        for (
          let node: HTMLElement | null = element;
          node && node !== document.documentElement;
          node = node.parentElement
        ) {
          const style = getComputedStyle(node)
          if (style.overflowX === 'visible' && style.overflowY === 'visible') {
            continue
          }
          const bounds = node.getBoundingClientRect()
          area.left = Math.max(area.left, bounds.left)
          area.top = Math.max(area.top, bounds.top)
          area.right = Math.min(area.right, bounds.right)
          area.bottom = Math.min(area.bottom, bounds.bottom)
        }
        return area
      }

      // The renderer keeps a hidden copy of each text, right before it, to
      // measure the fit with.
      return [
        ...root.querySelectorAll<HTMLElement>('div[aria-hidden="true"] + div'),
      ]
        .map((element) => {
          const text = element.innerText.replace(/\s+/g, ' ').trim()
          const box = element.parentElement as HTMLElement
          // Words only: a space a line breaks after hangs past the edge of the
          // box, where it is cut off without anything missing from view.
          const words: DOMRect[] = []
          const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
          )
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            for (const word of (node.textContent ?? '').matchAll(/\S+/g)) {
              const range = document.createRange()
              range.setStart(node, word.index)
              range.setEnd(node, word.index + word[0].length)
              // WebKit adds an empty rect where a word's line starts.
              words.push(
                ...[...range.getClientRects()].filter((rect) => rect.width > 0),
              )
            }
          }
          words.sort((a, b) => a.top - b.top)
          let lines = 0
          let lastTop = Number.NEGATIVE_INFINITY
          for (const word of words) {
            if (word.top - lastTop > word.height / 2) lines++
            lastTop = word.top
          }
          const area = visibleArea(box)
          const fontSize = Number.parseFloat(getComputedStyle(element).fontSize)
          return {
            text,
            lines,
            fontShare:
              Math.round((fontSize / box.getBoundingClientRect().width) * 1e6) /
              1e6,
            hiddenWords: words.filter(
              (word) =>
                word.left < area.left - 1 ||
                word.top < area.top - 1 ||
                word.right > area.right + 1 ||
                word.bottom > area.bottom + 1,
            ).length,
          }
        })
        .filter(({ text }) => text && !time.test(text))
    },
    { rootSelector, timePattern: TIME_TEXT.source },
  )
}

/** The texts once the slide is up and has stopped moving. */
async function readSettledTexts(
  page: Page,
  rootSelector: string,
): Promise<DrawnText[]> {
  let previous = ''
  let texts: DrawnText[] = []
  await expect
    .poll(
      async () => {
        texts = await readTexts(page, rootSelector)
        const current = JSON.stringify(texts)
        const settled =
          current === previous &&
          texts.some(({ text }) => text.includes(FIRST_LYRIC))
        previous = current
        return settled
      },
      { timeout: 15000, intervals: [500] },
    )
    .toBe(true)
  return texts
}

test.describe('Control Room preview matches the projection', () => {
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`draws the last slide as the projection does at ${viewport.width}x${viewport.height}`, async ({
      page,
      request,
    }) => {
      const screen = await getPreviewScreen(request)
      await serveScreen(page, screen.id)
      await servePresentation(page)

      await page.setViewportSize({ width: screen.width, height: screen.height })
      await page.goto(`/screen/${screen.id}`)
      const projection = await readSettledTexts(page, 'body')

      await page.setViewportSize(viewport)
      await page.goto('/present')
      await expect(page.getByTestId('live-preview')).toBeVisible({
        timeout: 15000,
      })
      const preview = await readSettledTexts(
        page,
        '[data-testid="live-preview"]',
      )

      // The configured label, on both, in place of the slide's own "Amin".
      expect.soft(projection.map(({ text }) => text)).toContain(AMEN_LABEL)
      expect
        .soft(preview.map(({ text }) => text).sort())
        .toEqual(projection.map(({ text }) => text).sort())

      for (const onScreen of projection) {
        expect
          .soft(onScreen.hiddenWords, `words of "${onScreen.text}" cut off`)
          .toBe(0)
      }
      for (const drawn of preview) {
        const onScreen = projection.find(({ text }) => text === drawn.text)
        if (!onScreen) continue
        expect
          .soft(drawn.hiddenWords, `words of "${drawn.text}" cut off`)
          .toBe(0)
        expect
          .soft(drawn.lines, `lines of "${drawn.text}"`)
          .toBe(onScreen.lines)
        expect
          .soft(
            Math.abs(drawn.fontShare / onScreen.fontShare - 1),
            `size of "${drawn.text}" relative to its box`,
          )
          .toBeLessThan(0.015)
      }
    })
  }
})
