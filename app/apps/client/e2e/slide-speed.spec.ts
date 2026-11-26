import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * Slides appear on the projector fast (T-158): from the operator's request to
 * the new slide fully visible on a screen, with no wait for a long exit and no
 * blank gap between slides. Timed in the screen window itself, so the server,
 * the websocket push and the fades all count.
 *
 * A change of content type (a song, then a verse) never shows both slides at
 * once: the old one fades out, then the new one fades in.
 */

const VERSES = [
  'Fiindcă atât de mult a iubit Dumnezeu lumea, că a dat pe singurul Lui Fiu.',
  'Dumnezeu, în adevăr, n-a trimis pe Fiul Său în lume ca să judece lumea.',
]

// v0.1.104 took ~800 ms for a slide change and ~1150 ms for a change of
// content type: a ~500 ms fade in, after waiting for the old slide's fade
// out. Now the fade starts at once (T-158) and lasts 400-450 ms on a strong
// ease-out, so the text reads almost at once and settles softly (#271).
//
// Request-to-screen latency (server, websocket, React) depends on the
// machine: a busy runner adds 100-500 ms to every slide alike, which broke
// absolute bounds on the whole time (T-188). So the fade and the start are
// bounded on their own, the start relative to this machine's latency.
/** Fully visible this long after it first shows: the 450 ms fade itself. */
const FADE_MAX_MS = 600
/**
 * A change may start this much later than a slide on a blank screen: the
 * latency jitters by up to ~200 ms on a loaded machine, while waiting for the
 * old slide's ~400 ms fade out, as before T-158, adds more than this.
 */
const START_SLACK_MS = 250
/** Request to first pixel on a blank screen: only a real regression is slower. */
const LATENCY_MAX_MS = 400
/**
 * A change of content type starts once the old slide has faded out: its
 * ~400 ms exit, plus the same latency slack as any slide.
 */
const TYPE_CHANGE_START_MAX_MS = 400 + START_SLACK_MS
/** Between the old type fading out and the new one fading in: a frame or two. */
const TYPE_CHANGE_GAP_MAX_MS = 150

function verseBody(index: number) {
  return {
    verseId: 9000 + index,
    reference: `Ioan 3:${16 + index}`,
    text: VERSES[index],
    translationAbbreviation: 'VDC',
    bookName: 'Ioan',
    translationId: 1,
    bookId: 43,
    bookCode: 'JHN',
    chapter: 3,
    currentVerseIndex: 15 + index,
  }
}

/** A schedule's Bible item: a passage, shown a verse at a time. */
function passageBody() {
  return {
    translationId: 1,
    translationAbbreviation: 'VDC',
    bookId: 43,
    bookCode: 'JHN',
    bookName: 'Ioan',
    startChapter: 3,
    startVerse: 16,
    endChapter: 3,
    endVerse: 17,
    verses: VERSES.map((text, index) => ({
      verseId: 9000 + index,
      verse: 16 + index,
      text,
    })),
    currentVerseIndex: 0,
  }
}

/**
 * A schedule's Bible reading, as programs store it now: one "Versete
 * Biblice" entry holding the whole passage, with no person name.
 */
function readingBody(text: string) {
  return {
    entries: [
      {
        id: 9200,
        personName: '',
        reference: 'Ioan 3:16-17',
        bookCode: 'JHN',
        bookName: 'Ioan',
        startChapter: 3,
        startVerse: 16,
        endChapter: 3,
        endVerse: 17,
        text,
        sortOrder: 0,
      },
    ],
    currentEntryIndex: 0,
  }
}

interface Timing {
  /** ms from the request until the new text is fully opaque and the old one gone */
  visibleMs: number
  /** ms from the request until the new text first shows at all */
  firstShowsMs: number
  /** longest stretch, in ms, with neither the old nor the new text showing */
  blankGapMs: number
  /** frames with both the old and the new text showing */
  overlapFrames: number
}

/**
 * Posts `body` to `path` from the screen window and times, frame by frame,
 * how long until `next` is fully visible and `previous` (if any) gone.
 */
function timeSlide(
  page: Page,
  path: string,
  body: unknown,
  next: string,
  previous?: string,
): Promise<Timing> {
  return page.evaluate(
    ({ path, body, next, previous }) =>
      new Promise<Timing>((resolve, reject) => {
        const opacityOf = (text: string) => {
          const anchor = [
            ...document.querySelectorAll<HTMLElement>('[data-style-anchor]'),
          ].find((element) => element.textContent?.includes(text))
          let opacity = anchor ? 1 : 0
          for (let el = anchor ?? null; el; el = el.parentElement) {
            opacity *= Number(getComputedStyle(el).opacity)
          }
          return opacity
        }
        const start = performance.now()
        let firstShowsMs = -1
        let blankSince = -1
        let blankGapMs = 0
        let overlapFrames = 0
        const sample = () => {
          const now = performance.now() - start
          const shown = opacityOf(next)
          const old = previous ? opacityOf(previous) : 0
          if (shown > 0.02 && firstShowsMs < 0) firstShowsMs = now
          const blank = shown <= 0.02 && old <= 0.02
          if (blank && blankSince < 0) blankSince = now
          if (!blank && blankSince >= 0) {
            blankGapMs = Math.max(blankGapMs, now - blankSince)
            blankSince = -1
          }
          if (shown > 0.02 && old > 0.02) overlapFrames++
          if (shown >= 0.999 && old === 0) {
            resolve({ visibleMs: now, firstShowsMs, blankGapMs, overlapFrames })
          } else if (now > 5000) {
            reject(new Error(`"${next}" not fully visible after 5 s`))
          } else {
            requestAnimationFrame(sample)
          }
        }
        fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).catch(reject)
        sample()
      }),
    { path, body, next, previous },
  )
}

async function createScreen(request: APIRequestContext) {
  const response = await request.post('/api/screens', {
    data: { name: `E2E Slide speed ${Date.now()}`, type: 'primary' },
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data as { id: number }
}

test.describe('Slides appear on the projector fast', () => {
  let screenId: number | undefined
  let songId: number | undefined
  const lyrics = [
    `Prima strofă ${Date.now()}`,
    `A doua strofă ${Date.now()}`,
    `Ultima strofă ${Date.now()}`,
  ]

  test.beforeAll(async ({ request }) => {
    screenId = (await createScreen(request)).id
    const song = await request.post('/api/songs', {
      data: {
        title: `E2E Slide speed song ${Date.now()}`,
        slides: lyrics.map((content, sortOrder) => ({ content, sortOrder })),
      },
    })
    expect(song.ok()).toBeTruthy()
    songId = (await song.json()).data.id as number
  })

  test.afterAll(async ({ request }) => {
    await request.post('/api/presentation/stop').catch(() => {})
    if (screenId) await request.delete(`/api/screens/${screenId}`)
    if (songId) await request.delete(`/api/songs/${songId}`)
  })

  test('the first slide, the next slide and a verse after a song all appear fast, a verse never over a song', async ({
    page,
    request,
  }) => {
    await request.post('/api/presentation/stop')
    await page.goto(`/screen/${screenId}`)
    await expect(page.locator('[data-style-anchor]')).toHaveCount(0)

    // Warm up: the screen's very first slide also loads code and fonts,
    // which took ~600 ms on a cold windows-latest runner (230-300 ms on the
    // church's PC). What is timed is a slide appearing on a blank screen,
    // the way it does each time the operator starts presenting.
    await timeSlide(
      page,
      '/api/presentation/temporary-song',
      { songId, slideIndex: 0 },
      lyrics[0],
    )
    await request.post('/api/presentation/stop')
    await expect(page.locator('[data-style-anchor]')).toHaveCount(0)

    const first = await timeSlide(
      page,
      '/api/presentation/temporary-song',
      { songId, slideIndex: 1 },
      lyrics[1],
    )
    await page.waitForTimeout(800)
    const next = await timeSlide(
      page,
      '/api/presentation/navigate-temporary',
      { direction: 'next', requestTimestamp: Date.now() },
      lyrics[2],
      lyrics[1],
    )
    await page.waitForTimeout(800)
    const typeChange = await timeSlide(
      page,
      '/api/presentation/temporary-bible',
      verseBody(0),
      VERSES[0],
      lyrics[2],
    )
    await page.waitForTimeout(800)
    const verseChange = await timeSlide(
      page,
      '/api/presentation/temporary-bible',
      verseBody(1),
      VERSES[1],
      VERSES[0],
    )
    await page.waitForTimeout(800)
    const backToSong = await timeSlide(
      page,
      '/api/presentation/temporary-song',
      { songId, slideIndex: 0 },
      lyrics[0],
      VERSES[1],
    )
    await page.waitForTimeout(800)
    const toPassage = await timeSlide(
      page,
      '/api/presentation/temporary-bible-passage',
      passageBody(),
      VERSES[0],
      lyrics[0],
    )

    await page.waitForTimeout(800)
    await timeSlide(
      page,
      '/api/presentation/temporary-song',
      { songId, slideIndex: 1 },
      lyrics[1],
      VERSES[0],
    )
    await page.waitForTimeout(800)
    const reading = `${VERSES[1]} (lectura)`
    const toReading = await timeSlide(
      page,
      '/api/presentation/temporary-versete-tineri',
      readingBody(reading),
      reading,
      lyrics[1],
    )

    const timings = {
      first,
      next,
      typeChange,
      verseChange,
      backToSong,
      toPassage,
      toReading,
    }
    test.info().annotations.push({
      type: 'timings',
      description: JSON.stringify(timings),
    })

    // A slide on a blank screen waits for nothing: its start is the latency.
    const latency = first.firstShowsMs
    expect(latency).toBeLessThan(LATENCY_MAX_MS)
    for (const timing of Object.values(timings)) {
      expect(timing.visibleMs - timing.firstShowsMs).toBeLessThan(FADE_MAX_MS)
    }
    // The next slide of the same type starts at once, crossfading with the
    // old one, without waiting for it to leave.
    for (const timing of [next, verseChange]) {
      expect(timing.firstShowsMs - latency).toBeLessThan(START_SLACK_MS)
      expect(timing.blankGapMs).toBeLessThan(50)
    }
    // A song and a verse are never on screen together: the old one fades
    // out, then the new one fades in right after.
    for (const timing of [typeChange, backToSong, toPassage, toReading]) {
      expect(timing.overlapFrames).toBe(0)
      expect(timing.firstShowsMs - latency).toBeLessThan(
        TYPE_CHANGE_START_MAX_MS,
      )
      expect(timing.blankGapMs).toBeLessThan(TYPE_CHANGE_GAP_MAX_MS)
    }
  })
})
