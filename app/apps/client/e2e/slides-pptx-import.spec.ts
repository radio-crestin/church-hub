import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
  type TestInfo,
  test,
} from '@playwright/test'
import JSZip from 'jszip'

import { MEDIA_API } from './helpers/background-media'

/**
 * Importing a PowerPoint file into a Slides item (CH-183, phase 3): read in
 * the browser, its pictures and videos uploaded to the Gallery, its slides as
 * editable deck slides as close to PowerPoint as the deck allows, and a
 * summary of what fell back to a picture, was left out or changed. The
 * fixtures are built part by part by fixtures/pptx/scripts/make-fixtures.py;
 * the expected boxes below are their EMU values on a 1920-wide deck.
 */

const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'pptx',
)
const fixture = (name: string) => path.join(FIXTURES, name)

/** The fixtures' slide size, 12192000 × 6858000 EMU, as 1920 × 1080. */
const DECK_WIDTH = 1920
const DECK_HEIGHT = 1080
const PX_PER_EMU = DECK_WIDTH / 12_192_000

interface DeckAnimation {
  id: string
  kind: string
  effect: string
  direction?: string
  trigger: string
  delayMs: number
  durationMs: number
  paragraphIndex?: number
}

interface DeckElement {
  id: string
  type: string
  x: number
  y: number
  w: number
  h: number
  rotation?: number
  html?: string
  fontFamily?: string
  fontSize?: number
  color?: string
  autofitScale?: number
  verticalAlign?: string
  shape?: string
  fill?: string
  mediaId?: string
  posterMediaId?: string
  autoplay?: boolean
  volume?: number
  reason?: string
  crop?: { l: number; t: number; r: number; b: number }
  animations?: DeckAnimation[]
}

interface DeckSlide {
  kind: string
  background?: { type: string; color?: string; mediaId?: string }
  transition?: { effect: string; direction?: string; durationMs: number }
  advanceAfterMs?: number
  elements: DeckElement[]
  animationOrder?: string[]
  notes?: string
}

interface Deck {
  width: number
  height: number
  slides: DeckSlide[]
  source?: { kind: string; fileName: string }
}

interface Note {
  slide: string
  reason: string
  outcome: string
  text: string
}

async function createPresentation(request: APIRequestContext) {
  const res = await request.post('/api/schedules', {
    data: { title: `E2E PowerPoint ${Date.now()}` },
  })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).data.id as number
}

async function savedDecks(
  request: APIRequestContext,
  scheduleId: number,
): Promise<{ id: number; deck: Deck }[]> {
  const res = await request.get(`/api/schedules/${scheduleId}`)
  const items = (await res.json()).data.items as {
    id: number
    itemType: string
    itemConfig: Deck
  }[]
  return items
    .filter((i) => i.itemType === 'slides')
    .map((i) => ({ id: i.id, deck: i.itemConfig }))
}

/** Every gallery file a deck refers to, to delete after the test. */
function deckMedia(deck: Deck): string[] {
  return deck.slides.flatMap((slide) => [
    ...(slide.background?.mediaId ? [slide.background.mediaId] : []),
    ...slide.elements.flatMap((e) =>
      [e.mediaId, e.posterMediaId].filter((id): id is string => !!id),
    ),
  ])
}

/** Waits for the import to finish and reads its summary's lines. */
async function finishedImport(page: Page): Promise<Note[]> {
  const dialog = page.getByTestId('pptx-import-dialog')
  await expect(dialog).toHaveAttribute('data-status', 'done', {
    timeout: 30_000,
  })
  await expect(dialog.getByTestId('pptx-import-summary')).toBeVisible()
  return dialog.getByTestId('pptx-import-note').evaluateAll((nodes) =>
    nodes.map((node) => ({
      slide: node.getAttribute('data-slide') ?? '',
      reason: node.getAttribute('data-reason') ?? '',
      outcome: node.getAttribute('data-outcome') ?? '',
      text: node.textContent ?? '',
    })),
  )
}

/** "Import PowerPoint" in the presentation's Add menu, with `file` chosen. */
async function importThroughMenu(page: Page, scheduleId: number, file: string) {
  await page.goto(`/schedules/${scheduleId}`)
  await page.getByTestId('schedule-add-item').click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByTestId('add-schedule-item-importPptx').click()
  await (await chooser).setFiles(fixture(file))
  const notes = await finishedImport(page)
  await page.getByTestId('pptx-import-done').click()
  await expect(page.getByTestId('pptx-import-dialog')).not.toBeVisible()
  return notes
}

/** Within 1% of the deck's size of the box the file gives, in EMU. */
function expectBox(
  element: DeckElement | undefined,
  [x, y, w, h]: [number, number, number, number],
) {
  expect(element).toBeTruthy()
  const near = (actual: number, emu: number, size: number) =>
    expect(Math.abs(actual - emu * PX_PER_EMU)).toBeLessThanOrEqual(size * 0.01)
  near(element!.x, x, DECK_WIDTH)
  near(element!.y, y, DECK_HEIGHT)
  near(element!.w, w, DECK_WIDTH)
  near(element!.h, h, DECK_HEIGHT)
}

function byId(slide: DeckSlide | undefined, id: string) {
  return slide?.elements.find((e) => e.id === id)
}

/** How many clicks a slide's main sequence waits for, read from the file. */
async function clicksInTimingTree(file: string, slide: number) {
  const zip = await JSZip.loadAsync(fs.readFileSync(fixture(file)))
  const xml = await zip.file(`ppt/slides/slide${slide}.xml`)!.async('string')
  return (xml.match(/nodeType="clickEffect"/g) ?? []).length
}

async function liveStep(request: APIRequestContext): Promise<string> {
  const res = await request.get('/api/presentation/state')
  const content = (await res.json()).data.temporaryContent
  if (!content || content.type !== 'deck_slide') return 'none'
  return `${content.data.slideIndex}.${content.data.buildIndex}`
}

function element(scope: Locator, id: string): Locator {
  return scope.locator(`[data-testid="deck-element"][data-element-id="${id}"]`)
}

/** Whether each paragraph of a text element shows, once its effects end. */
function paragraphsShown(scope: Locator, id: string) {
  return element(scope, id)
    .locator('[data-deck-text] li')
    .evaluateAll((items) =>
      items.map(
        (li) =>
          getComputedStyle(li).visibility === 'visible' &&
          li.getAnimations().length === 0,
      ),
    )
}

async function expectStep(
  page: Page,
  request: APIRequestContext,
  testInfo: TestInfo,
  step: string,
  shown: Record<string, boolean>,
  paragraphs: boolean[],
) {
  await expect.poll(() => liveStep(request)).toBe(step)
  const preview = page.getByTestId('live-preview')
  await expect(preview.getByTestId('deck-slide')).toHaveAttribute(
    'data-build-index',
    step.split('.')[1]!,
  )
  for (const [id, visible] of Object.entries(shown)) {
    await expect(element(preview, id)).toHaveAttribute(
      'data-visible',
      String(visible),
    )
  }
  await expect.poll(() => paragraphsShown(preview, '3')).toEqual(paragraphs)
  await page.waitForTimeout(2_200)
  await preview.screenshot({ path: testInfo.outputPath(`step-${step}.png`) })
  // TODO(CH-183 Q-2): compare this step's screenshot with PowerPoint's
  // render of the same click once reference images exist.
}

/**
 * Drops a file on the page as a file from outside would: a synthetic drop
 * carrying it (like file-drop-import.spec), once the presentation's page has
 * taken .pptx drops, so the drop cannot race it.
 */
async function dropFile(page: Page, file: string, mime: string) {
  await expect(page.getByTestId('pptx-drop-target')).toHaveAttribute(
    'data-ready',
    'true',
  )
  await page.evaluate(
    ({ base64, name, type }) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const transfer = new DataTransfer()
      transfer.items.add(new File([bytes], name, { type }))
      document.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }),
      )
    },
    {
      base64: fs.readFileSync(file).toString('base64'),
      name: path.basename(file),
      type: mime,
    },
  )
}

const PPTX_MIME =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'

/** The song a drop opened, deleted (its page is /songs/<id>). */
async function deleteOpenedSong(page: Page, request: APIRequestContext) {
  await expect(page).toHaveURL(/\/songs\/\d+/, { timeout: 30_000 })
  const id = page.url().match(/\/songs\/(\d+)/)?.[1]
  await request.delete(`/api/songs/${id}`)
}

test.describe('PowerPoint import', () => {
  const uploaded: string[] = []
  let scheduleId = 0

  test.beforeEach(async ({ page, request }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    scheduleId = await createPresentation(request)
  })

  test.afterEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary')
    for (const { deck } of await savedDecks(request, scheduleId)) {
      uploaded.push(...deckMedia(deck))
    }
    for (const id of uploaded.splice(0)) {
      await request.delete(`${MEDIA_API}/${id}`)
    }
  })

  test('a title and bullets keep their master, layout, theme colours and fonts; a cropped picture', async ({
    page,
    request,
  }) => {
    const notes = await importThroughMenu(
      page,
      scheduleId,
      'a-inheritance.pptx',
    )
    expect(notes).toEqual([])
    await expect(page.getByTestId('schedule-item')).toContainText(
      'Bine ați venit',
    )

    const [{ deck }] = await savedDecks(request, scheduleId)
    expect(deck.width).toBe(DECK_WIDTH)
    expect(deck.height).toBe(DECK_HEIGHT)
    expect(deck.source).toEqual({
      kind: 'pptx',
      fileName: 'a-inheritance.pptx',
    })
    expect(deck.slides).toHaveLength(1)
    const slide = deck.slides[0]

    // The master's background: Background 2, 25 % darker (E7E6E6 → AEAAAA).
    expect(slide?.background?.type).toBe('color')
    const [r, g, b] = (slide?.background?.color ?? '')
      .match(/[0-9a-f]{2}/gi)!
      .map((hex) => Number.parseInt(hex, 16))
    expect(Math.abs(r! - 0xae)).toBeLessThanOrEqual(3)
    expect(Math.abs(g! - 0xaa)).toBeLessThanOrEqual(3)
    expect(Math.abs(b! - 0xaa)).toBeLessThanOrEqual(3)

    // The master's own bar, under the slide's shapes.
    const bar = byId(slide, 'm7')
    expect(bar).toMatchObject({ type: 'shape', shape: 'rect', fill: '#c00000' })
    expectBox(bar, [0, 6_629_400, 12_192_000, 228_600])

    // The title: the master's place (the layout's has none), its title
    // style (44 pt bold, Text 2, the theme's heading font).
    const title = byId(slide, '2')
    expectBox(title, [838_200, 365_125, 10_515_600, 1_325_563])
    expect(title).toMatchObject({
      type: 'text',
      fontFamily: 'Cambria',
      fontSize: 88,
      color: '#1f3864',
      verticalAlign: 'middle',
    })
    expect(title?.html).toContain('<strong>Bine ați venit</strong>')

    // The body: the layout's place, the master's body style (28 pt, Text 1,
    // the theme's body font), autofit at 85 %, bullets as list items.
    const body = byId(slide, '3')
    expectBox(body, [838_200, 1_690_688, 10_515_600, 4_486_275])
    expect(body).toMatchObject({
      type: 'text',
      fontFamily: 'Calibri',
      fontSize: 56,
      color: '#000000',
      autofitScale: 0.85,
    })
    const items = [...(body?.html ?? '').matchAll(/<li[^>]*>(.*?)<\/li>/g)]
    expect(items.map((m) => m[1]!.replace(/<[^>]+>/g, ''))).toEqual([
      'Primul punct',
      'Al doilea punct',
      'Un subpunct',
      'Cuvânt important',
    ])
    expect(body?.html).toMatch(/^<ul>/)
    // The second level is indented and smaller (24 pt of 28).
    expect(items[2]![0]).toMatch(/margin-left: [\d.]+em/)
    expect(items[2]![0]).toContain('font-size: 0.857em')
    expect(items[3]![0]).toMatch(
      /<span style="color: #ff0000"><strong>important<\/strong><\/span>/,
    )

    // The empty date placeholder is left out, as in a show.
    expect(byId(slide, '4')).toBeUndefined()

    // The picture, cropped as in PowerPoint, uploaded to the Gallery.
    const picture = byId(slide, '5')
    expectBox(picture, [8_000_000, 4_000_000, 3_000_000, 2_000_000])
    expect(picture?.type).toBe('image')
    expect(picture?.crop).toEqual({ l: 0.1, t: 0.2, r: 0.05, b: 0 })
    const media = await request.get(`${MEDIA_API}/${picture?.mediaId}`)
    expect(media.ok()).toBeTruthy()
    expect(media.headers()['content-type']).toContain('image/png')

    expect(slide?.notes).toBe('Notă pentru predicator')

    // Calibri falls back to the bundled Carlito, Romanian letters included.
    const faces = await page.evaluate(async () => {
      const loaded = await document.fonts.load('16px Carlito', 'ș ț ă î â')
      return loaded.map((face) => face.family)
    })
    expect(faces.length).toBeGreaterThan(0)
  })

  test('click animations play click by click as in PowerPoint', async ({
    page,
    request,
  }, testInfo) => {
    const notes = await importThroughMenu(page, scheduleId, 'b-animations.pptx')
    expect(notes).toEqual([
      expect.objectContaining({
        slide: '1',
        reason: 'transition',
        outcome: 'changed',
      }),
    ])

    const [{ deck }] = await savedDecks(request, scheduleId)
    expect(deck.slides).toHaveLength(2)
    const [first, second] = deck.slides
    // The layout's background: its theme fill in Accent 5.
    expect(first?.background).toEqual({ type: 'color', color: '#5b9bd5' })
    // Vortex has no match: a fade of its length.
    expect(first?.transition).toEqual({ effect: 'fade', durationMs: 2000 })
    expect(second?.transition).toEqual({
      effect: 'wipe',
      direction: 'up',
      durationMs: 750,
    })

    const animation = (elementId: string, index = 0) =>
      byId(first, elementId)?.animations?.[index]
    expect(animation('2')).toMatchObject({
      kind: 'entrance',
      effect: 'fade',
      trigger: 'click',
      durationMs: 500,
    })
    expect(byId(first, '3')?.animations).toEqual([
      expect.objectContaining({
        kind: 'entrance',
        effect: 'fly',
        direction: 'left',
        trigger: 'click',
        paragraphIndex: 0,
      }),
      expect.objectContaining({
        kind: 'entrance',
        effect: 'fly',
        direction: 'left',
        trigger: 'click',
        paragraphIndex: 1,
      }),
    ])
    expect(animation('4')).toMatchObject({
      kind: 'entrance',
      effect: 'zoom',
      trigger: 'with_previous',
    })
    // The rectangle's outline and its text leave together.
    expect(animation('5')).toMatchObject({
      kind: 'exit',
      effect: 'fade',
      trigger: 'after_previous',
    })
    expect(animation('5-text')).toMatchObject({
      kind: 'exit',
      effect: 'fade',
      trigger: 'with_previous',
    })
    expect(animation('2', 1)).toMatchObject({
      kind: 'emphasis',
      effect: 'spin',
      trigger: 'click',
      durationMs: 2000,
    })
    // PowerPoint's play order.
    expect(first?.animationOrder).toEqual([
      animation('2')?.id,
      byId(first, '3')?.animations?.[0]?.id,
      byId(first, '3')?.animations?.[1]?.id,
      animation('4')?.id,
      animation('5')?.id,
      animation('5-text')?.id,
      animation('2', 1)?.id,
    ])
    // As many clicks as the timing tree waits for.
    const clicks = (first?.animationOrder ?? [])
      .map((id) =>
        first?.elements
          .flatMap((e) => e.animations ?? [])
          .find((a) => a.id === id),
      )
      .filter((a) => a?.trigger === 'click').length
    expect(clicks).toBe(await clicksInTimingTree('b-animations.pptx', 1))
    expect(clicks).toBe(4)

    // Presented: Down plays each click, then brings the next slide in.
    const row = page
      .getByTestId('schedule-item')
      .filter({ hasText: 'Cântarea zilei' })
    await row.getByText('Cântarea zilei').first().click()
    await page.keyboard.press('ArrowDown')
    await expectStep(
      page,
      request,
      testInfo,
      '0.0',
      { '2': false, '4': false, '5': true, '5-text': true },
      [false, false],
    )
    await page.keyboard.press('ArrowDown')
    await expectStep(
      page,
      request,
      testInfo,
      '0.1',
      { '2': true, '4': false, '5': true },
      [false, false],
    )
    await page.keyboard.press('ArrowDown')
    await expectStep(
      page,
      request,
      testInfo,
      '0.2',
      { '2': true, '4': false, '5': true },
      [true, false],
    )
    await page.keyboard.press('ArrowDown')
    await expectStep(
      page,
      request,
      testInfo,
      '0.3',
      { '2': true, '4': true, '5': false, '5-text': false },
      [true, true],
    )
    await page.keyboard.press('ArrowDown')
    await expectStep(
      page,
      request,
      testInfo,
      '0.4',
      { '2': true, '4': true, '5': false },
      [true, true],
    )
    await page.keyboard.press('ArrowDown')
    await expect.poll(() => liveStep(request)).toBe('1.0')
  })

  test('an embedded video plays by itself with its poster; a push transition advances by itself', async ({
    page,
    request,
  }) => {
    const notes = await importThroughMenu(page, scheduleId, 'c-video.pptx')
    expect(notes).toEqual([
      expect.objectContaining({
        slide: '2',
        reason: 'convertVideo',
        outcome: 'picture',
      }),
    ])
    expect(notes[0]?.text).toContain('Old clip')

    const [{ deck }] = await savedDecks(request, scheduleId)
    const slide = deck.slides[1]
    expect(slide?.background).toEqual({ type: 'color', color: '#101820' })
    expect(slide?.transition).toEqual({
      effect: 'push',
      direction: 'right',
      durationMs: 1200,
    })
    expect(slide?.advanceAfterMs).toBe(5000)

    const video = byId(slide, '4')
    expectBox(video, [1_524_000, 857_250, 6_096_000, 3_429_000])
    expect(video).toMatchObject({ type: 'video', autoplay: true, volume: 0.8 })
    expect(video?.posterMediaId).toBeTruthy()
    const file = await request.get(`${MEDIA_API}/${video?.mediaId}`)
    expect(file.headers()['content-type']).toContain('video/mp4')

    // The WMV keeps only its poster.
    const old = byId(slide, '5')
    expect(old?.type).toBe('image')
    expectBox(old, [8_000_000, 4_500_000, 3_000_000, 1_687_500])
  })

  test('a group, a SmartArt and a chart come in as shapes and fallback pictures', async ({
    page,
    request,
  }) => {
    const notes = await importThroughMenu(
      page,
      scheduleId,
      'd-group-smartart.pptx',
    )
    expect(notes.map((n) => [n.reason, n.outcome])).toEqual([
      ['chart', 'picture'],
      ['shape', 'changed'],
      ['table', 'changed'],
    ])

    const [{ deck }] = await savedDecks(request, scheduleId)
    const slide = deck.slides[0]

    // The group's children, scaled ×2 from its child space onto the slide.
    const rotated = byId(slide, '3')
    expectBox(rotated, [1_000_000, 1_000_000, 2_000_000, 1_000_000])
    expect(rotated).toMatchObject({
      type: 'shape',
      shape: 'rect',
      rotation: 45,
      fill: '#00b050',
    })
    const oval = byId(slide, '4')
    expectBox(oval, [3_000_000, 2_000_000, 2_000_000, 1_000_000])
    expect(oval).toMatchObject({ shape: 'ellipse', fill: '#ffc000' })

    // The SmartArt's drawing: its three shapes inside the frame.
    const parts = slide!.elements.filter(
      (e) => e.id.startsWith('5-') && e.type === 'shape',
    )
    expect(parts.map((e) => e.shape)).toEqual([
      'roundRect',
      'roundRect',
      'roundRect',
    ])
    expectBox(parts[0], [6_000_000, 1_000_000, 1_500_000, 1_000_000])
    expectBox(parts[2], [9_500_000, 1_000_000, 1_500_000, 1_000_000])
    const texts = slide!.elements
      .filter((e) => e.id.startsWith('5-') && e.type === 'text')
      .map((e) => e.html?.replace(/<[^>]+>/g, ''))
    expect(texts).toEqual(['Unu', 'Doi', 'Trei'])

    // The chart, as the picture the file gives for it.
    const chart = byId(slide, '6')
    expect(chart).toMatchObject({ type: 'picture_fallback', reason: 'chart' })
    expectBox(chart, [1_000_000, 3_800_000, 4_000_000, 2_500_000])

    // A star the deck cannot draw: a rectangle with its fill.
    expect(byId(slide, '7')).toMatchObject({ shape: 'rect', fill: '#7030a0' })
    // The table's cells, in a text box.
    expect(byId(slide, '8')?.html).toContain('Duminică')
  })

  test('a .pptx dropped on the presentation asks: as slides or as a song; a .ppt stays a song', async ({
    page,
    request,
  }) => {
    await page.goto(`/schedules/${scheduleId}`)

    // As slides: the same import as Add > Import PowerPoint.
    await dropFile(page, fixture('a-inheritance.pptx'), PPTX_MIME)
    const choice = page.getByTestId('pptx-drop-choice')
    await expect(choice).toBeVisible()
    await expect(choice).toContainText('a-inheritance.pptx')
    await choice.getByTestId('pptx-drop-as-slides').click()
    expect(await finishedImport(page)).toEqual([])
    await page.getByTestId('pptx-import-done').click()
    const decks = await savedDecks(request, scheduleId)
    expect(decks).toHaveLength(1)
    expect(decks[0]?.deck.source?.fileName).toBe('a-inheritance.pptx')
    await expect(page.getByTestId('schedule-item')).toContainText(
      'Bine ați venit',
    )

    // As a song: what a drop does on every other page.
    await dropFile(page, fixture('a-inheritance.pptx'), PPTX_MIME)
    await choice.getByTestId('pptx-drop-as-song').click()
    await deleteOpenedSong(page, request)
    expect(await savedDecks(request, scheduleId)).toHaveLength(1)

    // A legacy .ppt is only ever a song: no question.
    await page.goto(`/schedules/${scheduleId}`)
    await dropFile(
      page,
      path.join(FIXTURES, '..', 'Se cuvine.ppt'),
      'application/vnd.ms-powerpoint',
    )
    await deleteOpenedSong(page, request)
    await expect(choice).toHaveCount(0)
  })

  test('the Slides editor inserts the slides of a PowerPoint file after its own', async ({
    page,
    request,
  }) => {
    const item = await request.post(`/api/schedules/${scheduleId}/items`, {
      data: {
        slides: {
          slides: [
            {
              id: 'own',
              kind: 'title',
              elements: [
                {
                  id: 't',
                  type: 'text',
                  x: 160,
                  y: 390,
                  w: 1600,
                  h: 300,
                  html: '<p>Bun venit</p>',
                },
              ],
            },
          ],
        },
      },
    })
    expect(item.status(), await item.text()).toBe(201)
    const itemId = (await item.json()).data.id as number

    await page.goto(`/schedules/${scheduleId}/slides/${itemId}`)
    await expect(page.getByTestId('deck-editor')).toBeVisible()
    await page.getByTestId('deck-editor-insert').click()
    const chooser = page.waitForEvent('filechooser')
    await page.getByTestId('deck-editor-insert-pptx').click()
    await (await chooser).setFiles(fixture('b-animations.pptx'))
    await finishedImport(page)
    await page.getByTestId('pptx-import-done').click()

    await expect(page.getByTestId('deck-editor-slide')).toHaveCount(3)
    await expect(page.getByTestId('deck-editor-status')).toHaveAttribute(
      'data-status',
      'saved',
      { timeout: 10_000 },
    )
    const [{ deck }] = await savedDecks(request, scheduleId)
    expect(deck.slides).toHaveLength(3)
    expect(deck.slides[0]?.elements[0]?.id).toBe('t')
    expect(byId(deck.slides[1], '3')?.animations).toHaveLength(2)
    expect(deck.slides[1]?.animationOrder).toHaveLength(7)
  })
})
