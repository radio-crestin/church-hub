import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * A slide change animates only what changed: when the next slide shares
 * lines with the one on screen (a chorus repeated with one line changed), the
 * shared lines stay perfectly still on the same DOM nodes while the changed
 * line fades out and its replacement fades in, with the slide's transition.
 * A slide that shares nothing still crossfades as a whole.
 */

const stamp = Date.now()
const CHORUS = [
  `Mărire Ție, Doamne ${stamp}`,
  'Cântăm cu bucurie',
  'Tu ne-ai dat viață',
  'Și har fără sfârșit',
]
const CHANGED_LINE = 'Cântăm cu credință'
const OTHER_VERSE = [
  `Pe ape liniștite ${stamp}`,
  'Mă duce Păstorul',
  'Sufletul mi-l înviorează',
  'Pe cărări drepte',
]
const SLIDES = [
  CHORUS,
  [CHORUS[0], CHANGED_LINE, CHORUS[2], CHORUS[3]],
  OTHER_VERSE,
]

const toHtml = (lines: string[]) =>
  lines.map((line) => `<p>${line}</p>`).join('')

interface KeptLine {
  /** Still the node the line had before the change */
  same: boolean
  /** Its opacity times its ancestors' */
  opacity: number
  /** Animations running on it */
  animations: number
}

interface Frame {
  /** The lines both slides share, in order (null when not on the page) */
  kept: (KeptLine | null)[]
  /** How opaque the line coming in looks (0 when not on the page) */
  incoming: number
  /** How opaque the line going away looks (0 when not on the page) */
  outgoing: number
  /** A whole slide fading out under the new one */
  slideCrossfade: boolean
  /** Lines fading out on their own over the new slide */
  lineMorph: boolean
}

interface SlideChange {
  /** Where the slide is drawn: the projector screen or the Control Room preview */
  root: string
  kept: string[]
  incoming: string
  outgoing: string
}

/**
 * Marks the shared lines' nodes, then samples every frame from before
 * `action` until the incoming line is fully shown and the outgoing one gone
 * for 20 frames (or 10 s).
 */
async function sampleSlideChange(
  page: Page,
  change: SlideChange,
  action: () => Promise<unknown>,
): Promise<Frame[]> {
  await page.evaluate(
    ({ root, kept, incoming, outgoing }) =>
      new Promise<void>((started) => {
        type Marked = HTMLElement & { __kept?: boolean }
        const shownLine = (text: string, inside = '') =>
          [
            ...document.querySelectorAll<Marked>(
              `${root} ${inside} [data-line]`,
            ),
          ].find(
            (line) =>
              line.textContent?.trim() === text &&
              getComputedStyle(line).visibility !== 'hidden',
          )
        const opacityOf = (element: HTMLElement | undefined) => {
          let opacity = element ? 1 : 0
          for (let el = element ?? null; el; el = el.parentElement) {
            opacity *= Number(getComputedStyle(el).opacity)
          }
          return opacity
        }
        for (const text of kept) {
          const line = shownLine(text, '[data-style-anchor]')
          if (line) line.__kept = true
        }

        const frames: Frame[] = []
        let settledFrames = 0
        const end = performance.now() + 10_000
        ;(window as unknown as { __frames: Promise<Frame[]> }).__frames =
          new Promise((resolve) => {
            const sample = () => {
              const frame: Frame = {
                kept: kept.map((text) => {
                  const line = shownLine(text, '[data-style-anchor]')
                  if (!line) return null
                  return {
                    same: line.__kept === true,
                    opacity: opacityOf(line),
                    animations: line.getAnimations().length,
                  }
                }),
                incoming: opacityOf(shownLine(incoming, '[data-style-anchor]')),
                outgoing: opacityOf(shownLine(outgoing)),
                // Empty elements (the gamă, "Amin") crossfade nothing.
                slideCrossfade: [
                  ...document.querySelectorAll(`${root} [data-leaving]`),
                ].some((layer) => layer.textContent?.trim()),
                lineMorph: !!document.querySelector(
                  `${root} [data-leaving-lines]`,
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

/**
 * The chorus slide followed by the same chorus with its second line changed:
 * the shared lines stay the same nodes, fully shown, with no animation on
 * them or above them, while the old line fades out where it was and the new
 * one fades in.
 */
async function expectOnlyTheChangedLineAnimates(
  page: Page,
  request: APIRequestContext,
  root: string,
) {
  const frames = await sampleSlideChange(
    page,
    {
      root,
      kept: [CHORUS[0], CHORUS[2], CHORUS[3]],
      incoming: CHANGED_LINE,
      outgoing: CHORUS[1],
    },
    async () => expect((await nextSlide(request)).ok()).toBeTruthy(),
  )

  for (const frame of frames) {
    for (const line of frame.kept) {
      expect(line).toEqual({ same: true, opacity: 1, animations: 0 })
    }
  }
  expect(
    frames.some((frame) => frame.slideCrossfade),
    'the whole slide never crossfades',
  ).toBe(false)
  expect(
    frames.some((frame) => frame.lineMorph),
    'the old line leaves on its own',
  ).toBe(true)
  expect(
    frames.some((frame) => isFading(frame.outgoing)),
    'old line fades out',
  ).toBe(true)
  expect(
    frames.some((frame) => isFading(frame.incoming)),
    'new line fades in',
  ).toBe(true)
  expect(frames.at(-1)).toMatchObject({ incoming: 1, outgoing: 0 })
  const scope = root ? page.locator(root) : page.locator('body')
  await expect(scope.locator('[data-style-anchor]')).toContainText(CHANGED_LINE)
  await expect(scope.getByText(CHORUS[1])).toHaveCount(0)
  await expect(scope.locator('[data-leaving-lines]')).toHaveCount(0)
}

function nextSlide(request: APIRequestContext) {
  return request.post('/api/presentation/navigate-temporary', {
    data: { direction: 'next', requestTimestamp: Date.now() },
  })
}

test.describe('Slide changes animate only the lines that changed', () => {
  let screenId: number | undefined
  let songId: number | undefined

  test.beforeAll(async ({ request }) => {
    const screen = await request.post('/api/screens', {
      data: { name: `E2E Line morph ${stamp}`, type: 'primary' },
    })
    expect(screen.ok()).toBeTruthy()
    screenId = (await screen.json()).data.id as number
    const song = await request.post('/api/songs', {
      data: {
        title: `E2E Line morph song ${stamp}`,
        slides: SLIDES.map((lines, sortOrder) => ({
          content: toHtml(lines),
          sortOrder,
        })),
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

  test('shared lines stay still while the changed line is replaced, and a slide sharing nothing crossfades', async ({
    page,
    request,
  }) => {
    await request.post('/api/presentation/temporary-song', {
      data: { songId, slideIndex: 0 },
    })
    await page.goto(`/screen/${screenId}`)
    const anchor = page.locator('[data-style-anchor]')
    await expect(anchor).toContainText(CHORUS[1])
    // Let the first slide's fade in finish.
    await page.waitForTimeout(800)

    await expectOnlyTheChangedLineAnimates(page, request, '')

    // A slide that shares no line: the whole slide crossfades, as before.
    await page.waitForTimeout(500)
    const crossfade = await sampleSlideChange(
      page,
      { root: '', kept: [], incoming: OTHER_VERSE[0], outgoing: CHORUS[0] },
      async () => expect((await nextSlide(request)).ok()).toBeTruthy(),
    )
    expect(
      crossfade.some((frame) => frame.slideCrossfade),
      'the old slide fades out as a whole',
    ).toBe(true)
    expect(
      crossfade.some((frame) => frame.lineMorph),
      'no line leaves on its own',
    ).toBe(false)
    expect(
      crossfade.some(
        (frame) => isFading(frame.incoming) && isFading(frame.outgoing),
      ),
      'the slides cross',
    ).toBe(true)
    expect(crossfade.at(-1)).toMatchObject({ incoming: 1, outgoing: 0 })
  })

  test('the Control Room preview animates only the changed line too', async ({
    page,
    request,
  }) => {
    await request.post('/api/presentation/temporary-song', {
      data: { songId, slideIndex: 0 },
    })
    await page.goto('/present')
    const preview = page.getByTestId('live-preview')
    await expect(preview.locator('[data-style-anchor]')).toContainText(
      CHORUS[1],
      { timeout: 15_000 },
    )
    await page.waitForTimeout(800)

    await expectOnlyTheChangedLineAnimates(
      page,
      request,
      '[data-testid="live-preview"]',
    )
  })
})
