import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * Factory transitions (T-112, made per screen type in T-158, calmer in #271):
 * every text element of a new screen gets its screen type's transitions, in on
 * a strong ease-out and out on a gentle ease-in, and the projected screen
 * plays them so on a verse change: the new verse eases in (400 ms) while the
 * old one leaves a little faster (350 ms), at the same time. The stage display
 * cuts, so the singers read each line at once.
 */

const SCREEN_TYPES = ['primary', 'stage', 'livestream', 'kiosk'] as const
const EASE_ENTER = 'cubic-bezier(0.23, 1, 0.32, 1)'
const EASE_EXIT = 'cubic-bezier(0.32, 0, 0.67, 0)'
const fade = (duration: number, easing: string) => ({
  type: 'fade',
  duration,
  delay: 0,
  easing,
})
const cut = { type: 'none', duration: 0, delay: 0, easing: 'ease-in-out' }
const dissolve = (
  show: number,
  hide: number,
  slideIn: number,
  slideOut: number,
) => ({
  animationIn: fade(show, EASE_ENTER),
  animationOut: fade(hide, EASE_EXIT),
  slideTransitionIn: fade(slideIn, EASE_ENTER),
  slideTransitionOut: fade(slideOut, EASE_ENTER),
})
const FACTORY: Record<
  (typeof SCREEN_TYPES)[number],
  Record<string, unknown>
> = {
  primary: dissolve(450, 400, 400, 350),
  kiosk: dissolve(450, 400, 400, 350),
  livestream: dissolve(350, 300, 350, 300),
  stage: {
    animationIn: cut,
    animationOut: cut,
    slideTransitionIn: cut,
    slideTransitionOut: cut,
  },
}
const VERSES = [
  'Fiindcă atât de mult a iubit Dumnezeu lumea, că a dat pe singurul Lui Fiu.',
  'Dumnezeu, în adevăr, n-a trimis pe Fiul Său în lume ca să judece lumea.',
]

interface Transition {
  type: string
  duration: number
  easing: string
}

async function createScreen(request: APIRequestContext, type: string) {
  const response = await request.post('/api/screens', {
    data: { name: `E2E Transitions ${type} ${Date.now()}`, type },
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data as { id: number }
}

function presentVerse(request: APIRequestContext, index: number) {
  return request.post('/api/presentation/temporary-bible', {
    data: {
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
    },
  })
}

interface Frame {
  /** How opaque each text looks: its opacity times its ancestors' (0 when not on the page). */
  opacities: number[]
  /** Every inline CSS transition on the page. */
  transitions: string[]
}

/**
 * Samples every frame from before `action` runs until each of `texts` has
 * held its `settled` opacity for 20 frames (or 10 s). The sampler is running
 * before the change is sent, and it waits for the change however long it
 * takes to arrive: a fixed window opened by an unawaited evaluate saw no fade
 * on a slower machine (T-151).
 */
async function sampleDuring(
  page: Page,
  texts: string[],
  settled: number[],
  action: () => Promise<unknown>,
): Promise<Frame[]> {
  await page.evaluate(
    ({ texts, settled }) =>
      new Promise<void>((started) => {
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
        const frames: Frame[] = []
        let settledFrames = 0
        const end = performance.now() + 10_000
        ;(window as unknown as { __frames: Promise<Frame[]> }).__frames =
          new Promise((resolve) => {
            const sample = () => {
              const opacities = texts.map(opacityOf)
              frames.push({
                opacities,
                transitions: [
                  ...document.querySelectorAll<HTMLElement>(
                    '[style*="transition"]',
                  ),
                ].map((element) => element.style.transition),
              })
              const atRest = opacities.every((o, i) => o === settled[i])
              settledFrames = atRest ? settledFrames + 1 : 0
              if (settledFrames >= 20 || performance.now() > end) {
                resolve(frames)
              } else requestAnimationFrame(sample)
            }
            sample()
            started()
          })
      }),
    { texts, settled },
  )
  await action()
  return page.evaluate(
    () => (window as unknown as { __frames: Promise<Frame[]> }).__frames,
  )
}

/** Each frame's opacity of `texts`, from before `action` until they settle. */
async function sampleOpacitiesDuring(
  page: Page,
  texts: string[],
  settled: number[],
  action: () => Promise<unknown>,
) {
  const frames = await sampleDuring(page, texts, settled, action)
  return frames.map((frame) => frame.opacities)
}

const isFading = (opacity: number) => opacity > 0.05 && opacity < 0.95

test.describe('Calm slide transitions', () => {
  const created: number[] = []
  let songId: number | undefined

  test.afterAll(async ({ request }) => {
    await request.post('/api/presentation/stop').catch(() => {})
    for (const id of created) {
      await request.delete(`/api/screens/${id}`).catch(() => {})
    }
    if (songId) await request.delete(`/api/songs/${songId}`).catch(() => {})
  })

  for (const type of SCREEN_TYPES) {
    test(`a new ${type} screen gets its factory transitions on every text`, async ({
      request,
    }) => {
      const screen = await createScreen(request, type)
      created.push(screen.id)
      const response = await request.get(`/api/screens/${screen.id}`)
      const configs = (await response.json()).data.contentConfigs as Record<
        string,
        Record<string, Record<string, Transition> | unknown>
      >

      let checked = 0
      for (const [contentType, config] of Object.entries(configs)) {
        for (const [name, element] of Object.entries(config)) {
          const fields = element as Record<string, Transition> | null
          if (!fields?.animationIn) continue
          for (const [key, transition] of Object.entries(FACTORY[type])) {
            expect(fields[key], `${contentType}.${name}.${key}`).toEqual(
              transition,
            )
          }
          checked++
        }
      }
      expect(checked).toBeGreaterThan(5)
    })
  }

  test('a verse change eases the old verse out and the new one in', async ({
    page,
    request,
  }) => {
    const screen = await createScreen(request, 'primary')
    created.push(screen.id)
    expect((await presentVerse(request, 0)).ok()).toBeTruthy()

    await page.goto(`/screen/${screen.id}`)
    await expect(page.getByText(VERSES[0]).last()).toBeVisible()

    const frames = await sampleDuring(page, [VERSES[1]], [1], async () =>
      expect((await presentVerse(request, 1)).ok()).toBeTruthy(),
    )
    const seen = [
      ...new Set(frames.flatMap((frame) => frame.transitions)),
    ].join(' | ')

    expect(seen).toContain(`400ms ${EASE_ENTER}`)
    expect(seen).toContain(`350ms ${EASE_ENTER}`)
    await expect(page.getByText(VERSES[1]).last()).toBeVisible()
    await expect(page.getByText(VERSES[0])).toHaveCount(0)
  })

  test('the first verse on an empty screen fades in', async ({
    page,
    request,
  }) => {
    const screen = await createScreen(request, 'primary')
    created.push(screen.id)
    await request.post('/api/presentation/stop')
    await page.goto(`/screen/${screen.id}`)
    await expect(page.locator('[data-style-anchor]')).toHaveCount(0)

    const frames = await sampleOpacitiesDuring(
      page,
      [VERSES[0]],
      [1],
      async () => expect((await presentVerse(request, 0)).ok()).toBeTruthy(),
    )
    const verse = frames.map(([opacity]) => opacity)

    expect(verse.some(isFading), 'the verse passes through a soft fade').toBe(
      true,
    )
    expect(verse.at(-1)).toBe(1)
  })

  test('a song, then a verse: the song fades out, then the verse fades in', async ({
    page,
    request,
  }) => {
    const lyric = `Cât de mare ești Tu, Doamne ${Date.now()}`
    const song = await request.post('/api/songs', {
      data: {
        title: `E2E Transitions Song ${Date.now()}`,
        slides: [
          { content: 'Prima strofă', sortOrder: 0 },
          { content: lyric, sortOrder: 1 },
          { content: 'Ultima strofă', sortOrder: 2 },
        ],
      },
    })
    expect(song.ok()).toBeTruthy()
    songId = (await song.json()).data.id as number
    const screen = await createScreen(request, 'primary')
    created.push(screen.id)
    await request.post('/api/presentation/temporary-song', {
      data: { songId, slideIndex: 1 },
    })
    await page.goto(`/screen/${screen.id}`)
    await expect(page.getByText(lyric).last()).toBeVisible()
    await page.waitForTimeout(800)

    const frames = await sampleOpacitiesDuring(
      page,
      [lyric, VERSES[0]],
      [0, 1],
      async () => expect((await presentVerse(request, 0)).ok()).toBeTruthy(),
    )

    expect(
      frames.some(([song]) => isFading(song)),
      'song fades out',
    ).toBe(true)
    expect(
      frames.some(([, verse]) => isFading(verse)),
      'verse fades in',
    ).toBe(true)
    // Never on screen together: the verse comes in once the song is gone.
    expect(
      frames.some(([song, verse]) => song > 0 && verse > 0),
      'they never cross',
    ).toBe(false)
    expect(frames.at(-1)).toEqual([0, 1])

    // The next verse after a song is a slide change too, not a cut.
    const verses = await sampleOpacitiesDuring(
      page,
      [VERSES[0], VERSES[1]],
      [0, 1],
      async () => expect((await presentVerse(request, 1)).ok()).toBeTruthy(),
    )
    expect(
      verses.some(([first]) => isFading(first)),
      'verse eases out',
    ).toBe(true)
    expect(
      verses.some(([, next]) => isFading(next)),
      'next eases in',
    ).toBe(true)
    expect(verses.at(-1)).toEqual([0, 1])
  })
})
