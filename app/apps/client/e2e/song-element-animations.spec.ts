import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * The song key ("gama") and the "Amin" are drawn next to the lyrics, and they
 * have to move with them: when the operator changes slide, the old words fade
 * out, then the new ones fade in, and the key / "Amin" follow the same beat.
 * They used to be removed and added the moment the slide changed, so "Amin"
 * popped in at once and vanished before the last verse had finished fading.
 */

const KEY = 'GAMA-Do'
const AMIN = 'AMIN-END'
const FIRST_LYRIC = 'First verse words'
const MIDDLE_LYRIC = 'Middle verse words'
const LAST_LYRIC = 'Last verse words'
const SLIDE_TRANSITION_MS = 250
/** Room for a frame or two of scheduling noise either side of the lyrics. */
const BEAT_TOLERANCE_MS = 150

interface Sample {
  at: number
  /** Opacity per tracked text; missing when the text is not on screen. */
  opacity: Record<string, number | undefined>
}

async function createScreen(request: APIRequestContext): Promise<number> {
  const response = await request.post('/api/screens', {
    data: { name: `E2E SongAnim ${Date.now()}`, type: 'primary' },
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data.id as number
}

async function setAminLabel(request: APIRequestContext, screenId: number) {
  const screen = (await (await request.get(`/api/screens/${screenId}`)).json())
    .data
  const config = screen.contentConfigs.song_last_slide
  config.amen = { ...config.amen, hidden: false, text: AMIN }
  const put = await request.put(
    `/api/screens/${screenId}/config/song_last_slide`,
    { data: { config } },
  )
  expect(put.ok()).toBeTruthy()
}

async function createSong(request: APIRequestContext): Promise<number> {
  const response = await request.post('/api/songs', {
    data: {
      title: `E2E SongAnim ${Date.now()}`,
      keyLine: KEY,
      slides: [FIRST_LYRIC, MIDDLE_LYRIC, LAST_LYRIC].map((text, i) => ({
        content: `<p>${text}</p>`,
        sortOrder: i,
      })),
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data.id as number
}

/** Starts recording the opacity of each text on every frame. */
function startSampling(page: Page, texts: string[]) {
  return page.evaluate((tracked) => {
    const w = window as unknown as { __samples: Sample[]; __stop: boolean }
    w.__samples = []
    w.__stop = false
    const opacityOf = (text: string) => {
      const leaf = [...document.querySelectorAll<HTMLElement>('div, span, p')]
        .filter((el) => el.textContent?.trim() === text)
        .filter((el) => !el.closest('[aria-hidden="true"]'))
        // The box holding a text also holds its hidden measuring copy.
        .filter((el) => !el.querySelector('[aria-hidden="true"]'))
        .pop()
      if (!leaf) return undefined
      let node: HTMLElement | null = leaf
      let opacity = 1
      while (node) {
        opacity *= Number.parseFloat(getComputedStyle(node).opacity)
        node = node.parentElement
      }
      return opacity
    }
    const tick = () => {
      w.__samples.push({
        at: performance.now(),
        opacity: Object.fromEntries(tracked.map((t) => [t, opacityOf(t)])),
      })
      if (!w.__stop) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, texts)
}

async function stopSampling(page: Page): Promise<Sample[]> {
  return page.evaluate(() => {
    const w = window as unknown as { __samples: Sample[]; __stop: boolean }
    w.__stop = true
    return w.__samples
  })
}

/** First moment the text is on screen and more opaque than `min`. */
function firstSeen(samples: Sample[], text: string, min: number) {
  return samples.find((s) => (s.opacity[text] ?? 0) > min)?.at
}

/** Last moment the text is on screen and more opaque than `min`. */
function lastSeen(samples: Sample[], text: string, min: number) {
  return [...samples].reverse().find((s) => (s.opacity[text] ?? 0) > min)?.at
}

/** The text as drawn: each text is preceded by a hidden copy used to measure it. */
function shown(page: Page, text: string) {
  return page.getByText(text).last()
}

async function navigate(request: APIRequestContext, direction: string) {
  const response = await request.post('/api/presentation/navigate-temporary', {
    data: { direction, requestTimestamp: Date.now() },
  })
  expect(response.ok()).toBeTruthy()
}

test.describe('Song key and Amin follow the lyrics', () => {
  let screenId: number
  let songId: number

  test.beforeEach(async ({ request, page }) => {
    screenId = await createScreen(request)
    await setAminLabel(request, screenId)
    songId = await createSong(request)
    await request.post('/api/presentation/temporary-song', {
      data: { songId, slideIndex: 0 },
    })
    await page.goto(`/screen/${screenId}`)
    await expect(shown(page, FIRST_LYRIC)).toBeVisible({ timeout: 15000 })
    await expect(shown(page, KEY)).toBeVisible()
  })

  test.afterEach(async ({ request }) => {
    await request.post('/api/presentation/stop')
    await request.delete(`/api/songs/${songId}`).catch(() => {})
    await request.delete(`/api/screens/${screenId}`).catch(() => {})
  })

  test('the key fades out with the first verse', async ({ page, request }) => {
    await startSampling(page, [KEY, FIRST_LYRIC])
    await page.waitForTimeout(300)
    await navigate(request, 'next')
    await expect(shown(page, MIDDLE_LYRIC)).toBeVisible()
    await page.waitForTimeout(SLIDE_TRANSITION_MS + 300)
    const samples = await stopSampling(page)

    const lyricGone = lastSeen(samples, FIRST_LYRIC, 0.05)!
    const keyGone = lastSeen(samples, KEY, 0.05)!
    expect(Math.abs(keyGone - lyricGone)).toBeLessThan(BEAT_TOLERANCE_MS)
  })

  test('Amin fades in with the last verse', async ({ page, request }) => {
    await navigate(request, 'next')
    await expect(shown(page, MIDDLE_LYRIC)).toBeVisible()
    await page.waitForTimeout(SLIDE_TRANSITION_MS + 400)

    await startSampling(page, [AMIN, MIDDLE_LYRIC, LAST_LYRIC])
    await page.waitForTimeout(300)
    await navigate(request, 'next')
    await expect(shown(page, LAST_LYRIC)).toBeVisible()
    await page.waitForTimeout(SLIDE_TRANSITION_MS + 600)
    const samples = await stopSampling(page)

    const lyricAppears = firstSeen(samples, LAST_LYRIC, 0.05)!
    const aminAppears = firstSeen(samples, AMIN, 0.05)!
    const lyricFull = firstSeen(samples, LAST_LYRIC, 0.95)!
    const aminFull = firstSeen(samples, AMIN, 0.95)!
    expect(Math.abs(aminAppears - lyricAppears)).toBeLessThan(BEAT_TOLERANCE_MS)
    expect(Math.abs(aminFull - lyricFull)).toBeLessThan(BEAT_TOLERANCE_MS)
  })

  test('Amin fades out with the last verse', async ({ page, request }) => {
    await navigate(request, 'next')
    await navigate(request, 'next')
    await expect(shown(page, AMIN)).toBeVisible()
    await page.waitForTimeout(SLIDE_TRANSITION_MS + 600)

    await startSampling(page, [AMIN, LAST_LYRIC])
    await page.waitForTimeout(300)
    await navigate(request, 'prev')
    await expect(shown(page, MIDDLE_LYRIC)).toBeVisible()
    await page.waitForTimeout(SLIDE_TRANSITION_MS + 300)
    const samples = await stopSampling(page)

    const lyricGone = lastSeen(samples, LAST_LYRIC, 0.05)!
    const aminGone = lastSeen(samples, AMIN, 0.05)!
    expect(Math.abs(aminGone - lyricGone)).toBeLessThan(BEAT_TOLERANCE_MS)
  })
})
