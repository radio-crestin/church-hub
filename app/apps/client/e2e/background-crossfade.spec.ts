import { expect, test } from '@playwright/test'

/**
 * A background change dissolves on the projection, in step with the text: a
 * song with its own background, then a verse on the screen's background. The
 * song's background stays while the song fades out; then the screen's
 * background fades in over it together with the verse, with the same timing.
 */

const ROOT = '[data-testid="screen-renderer-root"]'
const SONG_COLOR = 'rgb(32, 64, 96)'
const VERSE = 'Fiindcă atât de mult a iubit Dumnezeu lumea.'

interface Frame {
  ms: number
  song: number
  verse: number
  layers: number
  /** Opacity of the topmost (newest) background layer */
  background: number
  backgroundColor: string
}

test.describe('Background changes dissolve with the text', () => {
  let screenId: number | undefined
  let songId: number | undefined
  const lyric = `Strofa cu fundal ${Date.now()}`

  test.beforeAll(async ({ request }) => {
    const screen = await request.post('/api/screens', {
      data: { name: `E2E Background dissolve ${Date.now()}`, type: 'primary' },
    })
    expect(screen.ok()).toBeTruthy()
    screenId = (await screen.json()).data.id
    const song = await request.post('/api/songs', {
      data: {
        title: `E2E Background dissolve ${Date.now()}`,
        slides: [{ content: lyric, sortOrder: 0 }],
        background: { type: 'color', color: '#204060', opacity: 1 },
      },
    })
    expect(song.ok()).toBeTruthy()
    songId = (await song.json()).data.id
  })

  test.afterAll(async ({ request }) => {
    await request.post('/api/presentation/stop').catch(() => {})
    if (screenId) await request.delete(`/api/screens/${screenId}`)
    if (songId) await request.delete(`/api/songs/${songId}`)
  })

  test("a verse after a song with its own background: the screen's background comes in with the verse", async ({
    page,
    request,
  }) => {
    await request.post('/api/presentation/stop')
    await page.goto(`/screen/${screenId}`)
    await expect(page.locator(ROOT)).toBeVisible()

    await request.post('/api/presentation/temporary-song', {
      data: { songId, slideIndex: 0 },
    })
    const background = page.locator(`${ROOT} [data-testid="screen-background"]`)
    await expect(background).toHaveCSS('background-color', SONG_COLOR)
    // The song and its background have finished coming in
    await expect(
      page.locator(`${ROOT} [data-testid="screen-background-layer"]`),
    ).toHaveCount(1)
    await page.waitForTimeout(600)

    const frames = await page.evaluate(
      ({ root, lyric, verse, songColor }) =>
        new Promise<Frame[]>((resolve, reject) => {
          const textOpacity = (text: string) => {
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
          const start = performance.now()
          const sample = () => {
            const layers = [
              ...document.querySelectorAll<HTMLElement>(
                `${root} [data-testid="screen-background-layer"]`,
              ),
            ]
            const top = layers[layers.length - 1]
            const frame = {
              ms: performance.now() - start,
              song: textOpacity(lyric),
              verse: textOpacity(verse),
              layers: layers.length,
              background: Number(getComputedStyle(top).opacity),
              backgroundColor: getComputedStyle(
                top.querySelector('[data-testid="screen-background"]') ?? top,
              ).backgroundColor,
            }
            frames.push(frame)
            const settled =
              frame.verse >= 0.999 &&
              frame.layers === 1 &&
              frame.backgroundColor !== songColor
            if (settled) resolve(frames)
            else if (frame.ms > 4000)
              reject(new Error('the verse and its background never settled'))
            else requestAnimationFrame(sample)
          }
          fetch('/api/presentation/temporary-bible', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              verseId: 9100,
              reference: 'Ioan 3:16',
              text: verse,
              translationAbbreviation: 'VDC',
              bookName: 'Ioan',
              translationId: 1,
              bookId: 43,
              bookCode: 'JHN',
              chapter: 3,
              currentVerseIndex: 15,
            }),
          }).catch(reject)
          sample()
        }),
      { root: ROOT, lyric, verse: VERSE, songColor: SONG_COLOR },
    )

    const isNewBackground = (f: Frame) =>
      f.layers > 1 || f.backgroundColor !== SONG_COLOR
    const verseStarts = frames.find((f) => f.verse > 0.02)
    const backgroundStarts = frames.find(
      (f) => isNewBackground(f) && f.background > 0.02,
    )
    const verseDone = frames.find((f) => f.verse >= 0.999)
    const backgroundDone = frames.find(
      (f) => isNewBackground(f) && f.background >= 0.999,
    )
    test.info().annotations.push({
      type: 'sync',
      description: JSON.stringify({
        verseStarts: verseStarts?.ms,
        backgroundStarts: backgroundStarts?.ms,
        verseDone: verseDone?.ms,
        backgroundDone: backgroundDone?.ms,
      }),
    })

    // While the song fades out, its own background stays.
    for (const frame of frames.filter((f) => f.song > 0.02)) {
      expect(frame.layers).toBe(1)
      expect(frame.backgroundColor).toBe(SONG_COLOR)
    }
    // The new background and the verse start together and settle together,
    // within three frames (a loaded machine delays the text by a frame).
    if (!verseStarts || !backgroundStarts || !verseDone || !backgroundDone) {
      throw new Error('the verse or its background never came in')
    }
    expect(Math.abs(verseStarts.ms - backgroundStarts.ms)).toBeLessThan(50)
    expect(Math.abs(verseDone.ms - backgroundDone.ms)).toBeLessThan(50)
    // In step all the way: the same duration and curve, so about the same
    // opacity each frame (a frame apart on the steep start of the ease-out is
    // ~0.3; another timing, like an 800 ms ease-in-out, is off by over 0.5).
    for (const frame of frames.filter((f) => f.layers > 1)) {
      expect(Math.abs(frame.background - frame.verse)).toBeLessThan(0.35)
    }
    // A dissolve, not a cut: the background passes through half opacity.
    expect(
      frames.some(
        (f) => f.layers > 1 && f.background > 0.2 && f.background < 0.8,
      ),
    ).toBe(true)
  })
})
