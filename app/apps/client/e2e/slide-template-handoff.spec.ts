import { type APIRequestContext, expect, test } from '@playwright/test'

import {
  backgroundOpacity,
  sampleTransition,
  type TransitionFrame,
} from './helpers/sample-transition'

/**
 * A slide in another template (a program's reading in its own theme, then a
 * song in the screen's) replaces the slide instead of restyling it: the old
 * slide fades out still drawn in its own template, then the new one fades in
 * in its own. The reading's template is red, so a red background under the
 * song, or a black one under the reading, means a slide was drawn in the
 * other one's template mid-transition.
 */

const RED = 'rgb(255, 0, 0)'
const READING = 'Domnul este Păstorul meu: nu voi duce lipsă de nimic.'
const ROOT = '[data-testid="screen-renderer-root"]'

interface Template {
  id: number
  bundledKey: string | null
  layouts: Record<string, Record<string, unknown>>
}

/** A copy of Classic whose every slide kind has a red background. */
async function redTemplate(request: APIRequestContext): Promise<number> {
  const all = (await (await request.get('/api/slide-templates')).json())
    .data as Template[]
  const classic = all.find((t) => t.bundledKey === 'classic') as Template
  const copy = (
    await (
      await request.post('/api/slide-templates', {
        data: { name: `E2E Reading theme ${Date.now()}`, fromId: classic.id },
      })
    ).json()
  ).data as Template
  const layouts = Object.fromEntries(
    Object.entries(copy.layouts).map(([kind, layout]) => [
      kind,
      {
        ...layout,
        background: { type: 'color', color: '#ff0000', opacity: 1 },
      },
    ]),
  )
  const saved = await request.put(`/api/slide-templates/${copy.id}`, {
    data: { layouts },
  })
  expect(saved.ok()).toBe(true)
  return copy.id
}

function readingBody(templateId: number) {
  return {
    entries: [
      {
        id: 9300,
        personName: '',
        reference: 'Psalmii 23:1',
        bookCode: 'PSA',
        bookName: 'Psalmii',
        startChapter: 23,
        startVerse: 1,
        endChapter: 23,
        endVerse: 1,
        text: READING,
        sortOrder: 0,
      },
    ],
    currentEntryIndex: 0,
    templateId,
  }
}

/** Old and new are never on screen together, text or background. */
function expectNoOverlap(
  frames: TransitionFrame[],
  old: (f: TransitionFrame) => number,
  next: (f: TransitionFrame) => number,
) {
  for (const frame of frames) {
    expect(
      old(frame) > 0.02 && next(frame) > 0.02,
      `old and new together at ${Math.round(frame.ms)} ms`,
    ).toBe(false)
  }
}

test.describe('A slide in another template replaces the slide', () => {
  let screenId: number | undefined
  let songId: number | undefined
  let templateId: number | undefined
  const lyric = `Strofa în tema ecranului ${Date.now()}`

  test.beforeAll(async ({ request }) => {
    templateId = await redTemplate(request)
    const screen = await request.post('/api/screens', {
      data: { name: `E2E Template handoff ${Date.now()}`, type: 'primary' },
    })
    expect(screen.ok()).toBeTruthy()
    screenId = (await screen.json()).data.id
    const song = await request.post('/api/songs', {
      data: {
        title: `E2E Template handoff ${Date.now()}`,
        slides: [{ content: lyric, sortOrder: 0 }],
      },
    })
    expect(song.ok()).toBeTruthy()
    songId = (await song.json()).data.id
  })

  test.afterAll(async ({ request }) => {
    await request.post('/api/presentation/stop').catch(() => {})
    if (screenId) await request.delete(`/api/screens/${screenId}`)
    if (songId) await request.delete(`/api/songs/${songId}`)
    if (templateId) await request.delete(`/api/slide-templates/${templateId}`)
  })

  test('a song, a reading in its own theme, and back: each fades out in its own template', async ({
    page,
    request,
  }) => {
    await request.post('/api/presentation/stop')
    await page.goto(`/screen/${screenId}`)
    await expect(page.locator(ROOT)).toBeVisible()
    await request.post('/api/presentation/temporary-song', {
      data: { songId, slideIndex: 0 },
    })
    await expect(page.locator(ROOT).getByText(lyric).last()).toBeVisible()
    await page.waitForTimeout(800)

    // The song leaves in the screen's template: no red under it.
    const toReading = await sampleTransition(page, {
      root: ROOT,
      texts: [lyric, READING],
      settledText: READING,
      path: '/api/presentation/temporary-versete-tineri',
      body: readingBody(templateId as number),
    })
    const song = (f: TransitionFrame) => f.texts[0]
    const reading = (f: TransitionFrame) => f.texts[1]
    const red = (f: TransitionFrame) => backgroundOpacity(f, RED)
    for (const frame of toReading.filter((f) => song(f) > 0.02)) {
      expect(red(frame), `red under the song at ${frame.ms} ms`).toBe(0)
    }
    expectNoOverlap(toReading, song, (f) => Math.max(reading(f), red(f)))
    expect(red(toReading[toReading.length - 1])).toBe(1)
    await page.waitForTimeout(800)

    // The reading leaves in its own template: red until it is gone.
    const toSong = await sampleTransition(page, {
      root: ROOT,
      texts: [READING, lyric],
      settledText: lyric,
      path: '/api/presentation/temporary-song',
      body: { songId, slideIndex: 0 },
    })
    const leavingReading = (f: TransitionFrame) => f.texts[0]
    const newSong = (f: TransitionFrame) => f.texts[1]
    for (const frame of toSong.filter((f) => leavingReading(f) > 0.02)) {
      expect(
        red(frame),
        `the reading lost its theme at ${frame.ms} ms`,
      ).toBeGreaterThan(leavingReading(frame) - 0.35)
    }
    expectNoOverlap(toSong, (f) => Math.max(leavingReading(f), red(f)), newSong)
    expect(red(toSong[toSong.length - 1])).toBe(0)
  })
})
