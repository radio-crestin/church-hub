import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * Calm factory transitions (T-112): every text element of every new screen
 * fades softly, eased at both ends, and the projected screen plays them so on
 * a verse change: the old verse eases out (300 ms), the new one eases in
 * (400 ms).
 */

const SCREEN_TYPES = ['primary', 'stage', 'livestream', 'kiosk'] as const
const CALM = {
  animationIn: 500,
  animationOut: 400,
  slideTransitionIn: 400,
  slideTransitionOut: 300,
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

/** Every inline CSS transition the page shows over the next `ms`. */
function collectTransitions(page: Page, ms: number) {
  return page.evaluate(
    (duration) =>
      new Promise<string[]>((resolve) => {
        const seen = new Set<string>()
        const end = performance.now() + duration
        const sample = () => {
          for (const element of document.querySelectorAll<HTMLElement>(
            '[style*="transition"]',
          )) {
            seen.add(element.style.transition)
          }
          if (performance.now() < end) requestAnimationFrame(sample)
          else resolve([...seen])
        }
        sample()
      }),
    ms,
  )
}

/**
 * How opaque each of `texts` looks on every frame over the next `ms`
 * (its opacity times its ancestors'; 0 when it is not on the page).
 */
function sampleOpacities(page: Page, texts: string[], ms: number) {
  return page.evaluate(
    ({ texts, duration }) =>
      new Promise<number[][]>((resolve) => {
        const frames: number[][] = []
        const end = performance.now() + duration
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
        const sample = () => {
          frames.push(texts.map(opacityOf))
          if (performance.now() < end) requestAnimationFrame(sample)
          else resolve(frames)
        }
        sample()
      }),
    { texts, duration: ms },
  )
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
    test(`a new ${type} screen fades every text softly`, async ({
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
          for (const [key, duration] of Object.entries(CALM)) {
            expect(fields[key], `${contentType}.${name}.${key}`).toEqual({
              type: 'fade',
              duration,
              delay: 0,
              easing: 'ease-in-out',
            })
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

    const transitions = collectTransitions(page, 1500)
    expect((await presentVerse(request, 1)).ok()).toBeTruthy()
    const seen = (await transitions).join(' | ')

    expect(seen).toContain('300ms ease-in-out')
    expect(seen).toContain('400ms ease-in-out')
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

    const sampling = sampleOpacities(page, [VERSES[0]], 1500)
    expect((await presentVerse(request, 0)).ok()).toBeTruthy()
    const verse = (await sampling).map(([opacity]) => opacity)

    expect(verse.some(isFading), 'the verse passes through a soft fade').toBe(
      true,
    )
    expect(verse.at(-1)).toBe(1)
  })

  test('a song, then a verse: the song fades out before the verse fades in', async ({
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

    const sampling = sampleOpacities(page, [lyric, VERSES[0]], 2000)
    expect((await presentVerse(request, 0)).ok()).toBeTruthy()
    const frames = await sampling

    expect(
      frames.some(([song]) => isFading(song)),
      'song fades out',
    ).toBe(true)
    expect(
      frames.some(([, verse]) => isFading(verse)),
      'verse fades in',
    ).toBe(true)
    expect(
      frames.every(([song, verse]) => song === 0 || verse === 0),
      'never both on screen',
    ).toBe(true)
    expect(frames.at(-1)).toEqual([0, 1])
  })
})
