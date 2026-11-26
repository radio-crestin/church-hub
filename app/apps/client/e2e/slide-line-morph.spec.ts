import {
  type APIRequestContext,
  type APIResponse,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * A slide change animates only what changed, down to single words: when the
 * next slide keeps most of the one on screen ("… slide 1" → "… slide 2", or a
 * chorus repeated with one word changed), every kept word stays perfectly
 * still on the same DOM node while only the changed word fades out and its
 * replacement fades in, with the slide's transition. A slide that shares
 * nothing still crossfades as a whole.
 */

const stamp = Date.now()
/** The song the user tried: two one-line slides that wrap on the screen. */
const TAKEOVER = [
  `E2E Bible Takeover ${stamp} slide 1`,
  `E2E Bible Takeover ${stamp} slide 2`,
]
const CHORUS = [
  `Mărire Ție, Doamne ${stamp}`,
  'Cântăm cu bucurie',
  'Tu ne-ai dat viață',
  'Și har fără sfârșit',
]
const OTHER_VERSE = [
  'Pe ape liniștite',
  'Mă duce Păstorul',
  'Sufletul mi-l înviorează',
  'Pe cărări drepte',
]
const CHORUS_SLIDES = [
  CHORUS,
  [CHORUS[0], 'Cântăm cu credință', CHORUS[2], CHORUS[3]],
  OTHER_VERSE,
]

/** Two verses in a row: the reference changes only its verse number. */
const VERSES = [
  {
    verse: 16,
    text: 'Fiindcă atât de mult a iubit Dumnezeu lumea, că a dat pe singurul Lui Fiu.',
  },
  {
    verse: 17,
    text: 'Dumnezeu, în adevăr, n-a trimis pe Fiul Său în lume ca să judece lumea.',
  },
]

function presentVerse(request: APIRequestContext, index: number) {
  const { verse, text } = VERSES[index]
  return request.post('/api/presentation/temporary-bible', {
    data: {
      verseId: 9000 + index,
      reference: `Ioan 3:${verse}`,
      text,
      translationAbbreviation: 'VDC',
      bookName: 'Ioan',
      translationId: 1,
      bookId: 43,
      bookCode: 'JHN',
      chapter: 3,
      currentVerseIndex: verse - 1,
    },
  })
}

const toHtml = (lines: string[]) =>
  lines.map((line) => `<p>${line}</p>`).join('')

interface KeptWord {
  text: string
  /** Still the node it had before the change, in the slide's text */
  same: boolean
  /** Its opacity times its ancestors' */
  opacity: number
  /** Opacity animations running on it or on its line */
  fades: number
  /** Other animations on it or its line: a glide to a new place */
  glides: number
}

interface Frame {
  /** Every word on screen before the change except the one that changes */
  kept: KeptWord[]
  /** How opaque the word coming in looks (0 when not on the page) */
  incoming: number
  /** How opaque the word going away looks, wherever it is drawn */
  outgoing: number
  /** An opacity animation is running on the incoming word or around it */
  incomingFades: boolean
  /** An opacity animation is running on the outgoing word or around it */
  outgoingFades: boolean
  /** The words drawn fading out on their own over the new slide */
  leavingWords: string[]
  /** A whole slide fading out under the new one */
  slideCrossfade: boolean
}

interface SlideChange {
  /** Where the slide is drawn: the projector screen or the Control Room preview */
  root: string
  incoming: string
  outgoing: string
  /** Kept words the change may move to a new place (they glide there) */
  mayGlide?: string[]
  /**
   * Text that marks the element watched, when it isn't the slide's main text
   * (a Bible reference holds its book name). Only that element must not
   * crossfade as a whole.
   */
  holds?: string
}

/**
 * Marks every word of the slide on screen except `outgoing`, then samples
 * every frame from before `action` until the incoming word is fully shown and
 * the outgoing one gone for 20 frames (or 10 s).
 */
async function sampleSlideChange(
  page: Page,
  change: SlideChange,
  action: () => Promise<unknown>,
): Promise<Frame[]> {
  await page.evaluate(
    ({ root, incoming, outgoing, holds }) =>
      new Promise<void>((started) => {
        type Marked = HTMLElement & { __kept?: boolean }
        const inRoot = (selector: string) => [
          ...document.querySelectorAll<Marked>(`${root} ${selector}`),
        ]
        // The slide's own text: not a slide fading out under it
        const currentText = () =>
          holds
            ? inRoot('[data-line]')
                .map((line) => line.parentElement?.parentElement as Marked)
                .find(
                  (text) =>
                    text.textContent?.includes(holds) &&
                    !text.closest('[data-leaving]') &&
                    !text.closest('[data-leaving-lines]'),
                )
            : inRoot('[data-style-anchor]').find(
                (anchor) => !anchor.closest('[data-leaving]'),
              )
        const wordsIn = (element: Element | undefined) => [
          ...(element?.querySelectorAll<Marked>('[data-token]') ?? []),
        ]
        const isShown = (element: HTMLElement) =>
          getComputedStyle(element).visibility !== 'hidden'
        const opacityOf = (element: HTMLElement | undefined) => {
          let opacity = element ? 1 : 0
          for (let el = element ?? null; el; el = el.parentElement) {
            opacity *= Number(getComputedStyle(el).opacity)
          }
          return opacity
        }
        const isOpacityAnimation = (animation: Animation) =>
          (animation.effect as KeyframeEffect)
            .getKeyframes()
            .some((keyframe) => 'opacity' in keyframe)
        // Seen even between two sparse frames: a slow machine may draw no
        // frame in the middle of a 300 ms fade.
        const isAnimatingOpacity = (element: HTMLElement | undefined) => {
          for (let el = element ?? null; el; el = el.parentElement) {
            if (
              el
                .getAnimations()
                .some(
                  (animation) =>
                    animation.playState === 'running' &&
                    isOpacityAnimation(animation),
                )
            )
              return true
          }
          return false
        }
        const outgoingWords = () =>
          inRoot('[data-token]').filter(
            (word) => word.textContent === outgoing && isShown(word),
          )

        const marked = wordsIn(currentText()).filter(
          (word) => word.textContent?.trim() && word.textContent !== outgoing,
        )
        for (const word of marked) word.__kept = true

        const frames: Frame[] = []
        let settledFrames = 0
        const end = performance.now() + 10_000
        ;(window as unknown as { __frames: Promise<Frame[]> }).__frames =
          new Promise((resolve) => {
            const sample = () => {
              const text = currentText()
              const incomingWord = wordsIn(text).find(
                (word) => word.textContent === incoming,
              )
              const frame: Frame = {
                kept: marked.map((word) => {
                  const animations = [
                    ...word.getAnimations(),
                    ...(word
                      .closest<HTMLElement>('[data-line]')
                      ?.getAnimations() ?? []),
                  ]
                  const fades = animations.filter(isOpacityAnimation).length
                  return {
                    text: word.textContent ?? '',
                    same: word.__kept === true && !!text?.contains(word),
                    opacity: opacityOf(word),
                    fades,
                    glides: animations.length - fades,
                  }
                }),
                incoming: opacityOf(incomingWord),
                outgoing: Math.max(0, ...outgoingWords().map(opacityOf)),
                incomingFades: isAnimatingOpacity(incomingWord),
                outgoingFades: outgoingWords().some(isAnimatingOpacity),
                leavingWords: inRoot('[data-leaving-lines] [data-token]')
                  .filter((word) => word.textContent?.trim() && isShown(word))
                  .map((word) => word.textContent ?? ''),
                // Empty elements (the gamă, "Amin") crossfade nothing.
                slideCrossfade: inRoot('[data-leaving]').some((layer) =>
                  holds
                    ? layer.textContent?.includes(holds)
                    : layer.textContent?.trim(),
                ),
              }
              frames.push(frame)
              const atRest = frame.incoming === 1 && frame.outgoing === 0
              settledFrames = atRest ? settledFrames + 1 : 0
              if (settledFrames >= 20 || performance.now() > end) {
                resolve(frames)
              } else requestAnimationFrame(sample)
            }
            sample()
            started()
          })
      }),
    change,
  )
  await action()
  return page.evaluate(
    () => (window as unknown as { __frames: Promise<Frame[]> }).__frames,
  )
}

const isFading = (opacity: number) => opacity > 0.05 && opacity < 0.95
const incomingFades = (frame: Frame) =>
  frame.incomingFades || isFading(frame.incoming)
const outgoingFades = (frame: Frame) =>
  frame.outgoingFades || isFading(frame.outgoing)

function nextSlide(request: APIRequestContext) {
  return request.post('/api/presentation/navigate-temporary', {
    data: { direction: 'next', requestTimestamp: Date.now() },
  })
}

/**
 * On every frame of the change, every other word keeps its node, fully shown,
 * never fading (and never moving, unless listed in `mayGlide`), and nothing but
 * `outgoing` fades out; `outgoing` fades out where it was while `incoming`
 * fades in.
 */
async function expectOnlyTheWordChanges(
  page: Page,
  request: APIRequestContext,
  change: SlideChange,
  present: () => Promise<APIResponse> = () => nextSlide(request),
) {
  const frames = await sampleSlideChange(page, change, async () =>
    expect((await present()).ok()).toBeTruthy(),
  )

  expect(frames[0].kept.length, 'the kept words were found').toBeGreaterThan(2)
  for (const frame of frames) {
    for (const { text, same, opacity, fades, glides } of frame.kept) {
      expect({ text, same, opacity, fades }).toEqual({
        text,
        same: true,
        opacity: 1,
        fades: 0,
      })
      if (!change.mayGlide?.includes(text))
        expect({ text, glides }).toEqual({ text, glides: 0 })
    }
    for (const word of frame.leavingWords) expect(word).toBe(change.outgoing)
  }
  expect(
    frames.some((frame) => frame.slideCrossfade),
    'the whole slide never crossfades',
  ).toBe(false)
  expect(frames.some(outgoingFades), `"${change.outgoing}" fades out`).toBe(
    true,
  )
  expect(frames.some(incomingFades), `"${change.incoming}" fades in`).toBe(true)
  expect(frames.at(-1)).toMatchObject({ incoming: 1, outgoing: 0 })
  await expect(page.locator(`${change.root} [data-leaving-lines]`)).toHaveCount(
    0,
  )
}

/** The rows the words of the slide's text sit on. */
async function wordRows(page: Page, root: string) {
  return page.evaluate((root) => {
    const anchor = document.querySelector(`${root} [data-style-anchor]`)
    const tops = [
      ...(anchor?.querySelectorAll<HTMLElement>('[data-token]') ?? []),
    ].map((word) => Math.round(word.getBoundingClientRect().top))
    return new Set(tops).size
  }, root)
}

async function createSong(request: APIRequestContext, slides: string[][]) {
  const song = await request.post('/api/songs', {
    data: {
      title: `E2E Line morph song ${stamp} ${slides.length}`,
      slides: slides.map((lines, sortOrder) => ({
        content: toHtml(lines),
        sortOrder,
      })),
    },
  })
  expect(song.ok()).toBeTruthy()
  return (await song.json()).data.id as number
}

test.describe('Slide changes animate only the words that changed', () => {
  let screenId: number | undefined
  let takeoverSongId: number | undefined
  let chorusSongId: number | undefined

  test.beforeAll(async ({ request }) => {
    const screen = await request.post('/api/screens', {
      data: { name: `E2E Line morph ${stamp}`, type: 'primary' },
    })
    expect(screen.ok()).toBeTruthy()
    screenId = (await screen.json()).data.id as number
    takeoverSongId = await createSong(
      request,
      TAKEOVER.map((line) => [line]),
    )
    chorusSongId = await createSong(request, CHORUS_SLIDES)
  })

  test.afterAll(async ({ request }) => {
    await request.post('/api/presentation/stop').catch(() => {})
    if (screenId) await request.delete(`/api/screens/${screenId}`)
    for (const id of [takeoverSongId, chorusSongId]) {
      if (id) await request.delete(`/api/songs/${id}`)
    }
  })

  test('"… slide 1" to "… slide 2": only the number fades, every other word stays still', async ({
    page,
    request,
  }) => {
    await request.post('/api/presentation/temporary-song', {
      data: { songId: takeoverSongId, slideIndex: 0 },
    })
    await page.goto(`/screen/${screenId}`)
    await expect(page.locator('[data-style-anchor]')).toContainText(TAKEOVER[0])
    expect(await wordRows(page, ''), 'the line wraps').toBeGreaterThan(1)
    await page.waitForTimeout(800)

    await expectOnlyTheWordChanges(page, request, {
      root: '',
      incoming: '2',
      outgoing: '1',
    })
    await expect(page.locator('[data-style-anchor]')).toContainText(TAKEOVER[1])
  })

  test('a chorus with one word changed keeps the rest; a slide sharing nothing crossfades', async ({
    page,
    request,
  }) => {
    await request.post('/api/presentation/temporary-song', {
      data: { songId: chorusSongId, slideIndex: 0 },
    })
    await page.goto(`/screen/${screenId}`)
    await expect(page.locator('[data-style-anchor]')).toContainText(CHORUS[1])
    await page.waitForTimeout(800)

    await expectOnlyTheWordChanges(page, request, {
      root: '',
      incoming: 'credință',
      outgoing: 'bucurie',
      // The wider word re-centres its line: the words before it glide.
      mayGlide: ['Cântăm', 'cu'],
    })

    // A slide that shares no line: the whole slide crossfades, as before.
    await page.waitForTimeout(500)
    const crossfade = await sampleSlideChange(
      page,
      { root: '', incoming: 'Păstorul', outgoing: 'Mărire' },
      async () => expect((await nextSlide(request)).ok()).toBeTruthy(),
    )
    expect(
      crossfade.some((frame) => frame.slideCrossfade),
      'the old slide fades out as a whole',
    ).toBe(true)
    expect(
      crossfade.every((frame) => frame.leavingWords.length === 0),
      'no word leaves on its own',
    ).toBe(true)
    expect(
      crossfade.some((frame) => incomingFades(frame) && outgoingFades(frame)),
      'the slides cross',
    ).toBe(true)
    expect(crossfade.at(-1)).toMatchObject({ incoming: 1, outgoing: 0 })
  })

  test('Ioan 3:16 to Ioan 3:17: only the verse number of the reference changes', async ({
    page,
    request,
  }) => {
    expect((await presentVerse(request, 0)).ok()).toBeTruthy()
    await page.goto(`/screen/${screenId}`)
    await expect(page.getByText(VERSES[0].text).last()).toBeVisible()
    await page.waitForTimeout(800)

    await expectOnlyTheWordChanges(
      page,
      request,
      { root: '', incoming: '17', outgoing: '16', holds: 'Ioan' },
      () => presentVerse(request, 1),
    )
    await expect(page.getByText(VERSES[1].text).last()).toBeVisible()
  })

  test('the Control Room preview changes only the number too', async ({
    page,
    request,
  }) => {
    const root = '[data-testid="live-preview"]'
    await request.post('/api/presentation/temporary-song', {
      data: { songId: takeoverSongId, slideIndex: 0 },
    })
    await page.goto('/present')
    await expect(page.locator(`${root} [data-style-anchor]`)).toContainText(
      TAKEOVER[0],
      { timeout: 15_000 },
    )
    await page.waitForTimeout(800)

    await expectOnlyTheWordChanges(page, request, {
      root,
      incoming: '2',
      outgoing: '1',
    })
  })
})

/**
 * Times every frame from just before `action` for `windowMs`, with nothing
 * else running in the page: the intervals between frames, in ms.
 */
async function frameIntervalsDuring(
  page: Page,
  windowMs: number,
  action: () => Promise<unknown>,
): Promise<number[]> {
  await page.evaluate(
    (windowMs) =>
      new Promise<void>((started) => {
        const stamps: number[] = []
        ;(window as unknown as { __stamps: Promise<number[]> }).__stamps =
          new Promise((resolve) => {
            const tick = (now: number) => {
              stamps.push(now)
              if (now - stamps[0] < windowMs) requestAnimationFrame(tick)
              else resolve(stamps)
            }
            requestAnimationFrame((now) => {
              tick(now)
              started()
            })
          })
      }),
    windowMs,
  )
  await action()
  const stamps = await page.evaluate(
    () => (window as unknown as { __stamps: Promise<number[]> }).__stamps,
  )
  return stamps.slice(1).map((stamp, i) => stamp - stamps[i])
}

/** The main projection's factory fade out when the presentation ends. */
const EXIT_MS = 400

/** Every way the slide leaves the screen, and the request that does it. */
const EXITS: [string, (request: APIRequestContext) => Promise<APIResponse>][] =
  [
    ['after the last slide', nextSlide],
    [
      'when hidden (Esc)',
      (request) => request.post('/api/presentation/clear-temporary'),
    ],
    [
      'when the presentation stops',
      (request) => request.post('/api/presentation/stop'),
    ],
  ]

interface ExitFrame {
  /** The frame's time (ms) */
  t: number
  /** How opaque the slide's text looks */
  opacity: number
  /** Whether the text is still on the page */
  present: boolean
}

/**
 * Samples every frame from just before `action` until the text containing
 * `text` has been gone for 10 frames (or 3 s).
 */
async function sampleExit(
  page: Page,
  text: string,
  action: () => Promise<unknown>,
): Promise<ExitFrame[]> {
  await page.evaluate(
    (text) =>
      new Promise<void>((started) => {
        const frames: ExitFrame[] = []
        let goneFrames = 0
        ;(window as unknown as { __exit: Promise<ExitFrame[]> }).__exit =
          new Promise((resolve) => {
            const sample = (t: number) => {
              const anchor = [
                ...document.querySelectorAll<HTMLElement>(
                  '[data-style-anchor]',
                ),
              ].find((element) => element.textContent?.includes(text))
              let opacity = anchor ? 1 : 0
              for (let el = anchor ?? null; el; el = el.parentElement) {
                opacity *= Number(getComputedStyle(el).opacity)
              }
              frames.push({ t, opacity, present: !!anchor })
              goneFrames = anchor ? 0 : goneFrames + 1
              if (goneFrames >= 10 || t - frames[0].t > 3000) resolve(frames)
              else requestAnimationFrame(sample)
            }
            requestAnimationFrame((t) => {
              sample(t)
              started()
            })
          })
      }),
    text,
  )
  await action()
  return page.evaluate(
    () => (window as unknown as { __exit: Promise<ExitFrame[]> }).__exit,
  )
}

/** Median frame interval about 16.7 ms or less and no frame over 50 ms. */
function expectSteadyFrames(label: string, intervals: number[]) {
  const sorted = [...intervals].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const p95 = sorted[Math.floor(sorted.length * 0.95)]
  test.info().annotations.push({
    type: 'frames',
    description: JSON.stringify({
      label,
      frames: intervals.length,
      median: median.toFixed(1),
      p95: p95.toFixed(1),
      max: sorted.at(-1)?.toFixed(1),
    }),
  })
  expect(median, `${label}: median frame interval (ms)`).toBeLessThanOrEqual(
    17.5,
  )
  expect(sorted.at(-1), `${label}: longest frame (ms)`).toBeLessThan(50)
}

test.describe('Slide changes and exits run at a steady frame rate on a full HD projector', () => {
  test.use({ viewport: { width: 1920, height: 1080 } })
  let screenId: number | undefined
  let songId: number | undefined

  // GitHub's runners draw WebKit without a GPU on shared CPUs: the same change
  // measured a median frame of 18 to 561 ms there, so it would time the
  // runner. Chromium there, and both browsers on a real machine, keep 60 fps.
  test.skip(
    ({ browserName }) =>
      browserName === 'webkit' && !!process.env.GITHUB_ACTIONS,
    "GitHub's GPU-less WebKit can't hold a frame rate",
  )

  test.beforeAll(async ({ request }) => {
    const screen = await request.post('/api/screens', {
      data: { name: `E2E Word morph frames ${stamp}`, type: 'primary' },
    })
    expect(screen.ok()).toBeTruthy()
    screenId = (await screen.json()).data.id as number
    songId = await createSong(
      request,
      TAKEOVER.map((line) => [line]),
    )
  })

  test.afterAll(async ({ request }) => {
    await request.post('/api/presentation/stop').catch(() => {})
    if (screenId) await request.delete(`/api/screens/${screenId}`)
    if (songId) await request.delete(`/api/songs/${songId}`)
  })

  test('"… slide 1" to "… slide 2" keeps every frame within budget', async ({
    page,
    request,
  }) => {
    await request.post('/api/presentation/temporary-song', {
      data: { songId, slideIndex: 0 },
    })
    await page.goto(`/screen/${screenId}`)
    await expect(page.locator('[data-style-anchor]')).toContainText(TAKEOVER[0])
    await page.waitForTimeout(800)

    const intervals = await frameIntervalsDuring(page, 700, async () =>
      expect((await nextSlide(request)).ok()).toBeTruthy(),
    )
    await expect(page.locator('[data-style-anchor]')).toContainText(TAKEOVER[1])
    expectSteadyFrames('slide 1 to slide 2', intervals)
  })

  test('Ioan 3:16 to Ioan 3:17 keeps every frame within budget', async ({
    page,
    request,
  }) => {
    expect((await presentVerse(request, 0)).ok()).toBeTruthy()
    await page.goto(`/screen/${screenId}`)
    await expect(page.getByText(VERSES[0].text).last()).toBeVisible()
    await page.waitForTimeout(800)

    const intervals = await frameIntervalsDuring(page, 700, async () =>
      expect((await presentVerse(request, 1)).ok()).toBeTruthy(),
    )
    await expect(page.getByText(VERSES[1].text).last()).toBeVisible()
    expectSteadyFrames('Ioan 3:16 to Ioan 3:17', intervals)
  })

  for (const [exit, leave] of EXITS) {
    test(`the slide fades out smoothly ${exit}`, async ({ page, request }) => {
      await request.post('/api/presentation/temporary-song', {
        data: { songId, slideIndex: 1 },
      })
      await page.goto(`/screen/${screenId}`)
      await expect(page.locator('[data-style-anchor]')).toContainText(
        TAKEOVER[1],
      )
      await page.waitForTimeout(800)

      const frames = await sampleExit(page, TAKEOVER[1], async () =>
        expect((await leave(request)).ok()).toBeTruthy(),
      )
      const opacities = frames.map((frame) => frame.opacity)
      expect(opacities.some(isFading), 'the text passes through a fade').toBe(
        true,
      )
      // It eases down to nothing: never brighter again once it starts.
      const start = opacities.findIndex((opacity) => opacity < 0.99)
      for (let i = start + 1; i < opacities.length; i++) {
        expect(opacities[i]).toBeLessThanOrEqual(opacities[i - 1] + 0.01)
      }
      const gone = opacities.findIndex(
        (opacity, i) => i > start && opacity === 0,
      )
      const fadeMs = frames[gone].t - frames[start].t
      expect(fadeMs, 'fade length (ms)').toBeGreaterThanOrEqual(EXIT_MS * 0.6)
      expect(fadeMs, 'fade length (ms)').toBeLessThanOrEqual(EXIT_MS + 150)
      expect(frames.at(-1)?.present, 'the text is removed').toBe(false)
      await expect(page.getByText(TAKEOVER[1])).toHaveCount(0)
      expectSteadyFrames(
        `fade out ${exit}`,
        frames.slice(1).map((frame, i) => frame.t - frames[i].t),
      )
    })
  }
})
