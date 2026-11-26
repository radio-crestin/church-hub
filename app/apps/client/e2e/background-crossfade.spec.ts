import { expect, test } from '@playwright/test'

/**
 * A background change dissolves on the projection instead of cutting: a song
 * with its own background, then a verse on the screen's background. The new
 * background fades in over the old one, which stays underneath until it is
 * covered, then leaves.
 */

const ROOT = '[data-testid="screen-renderer-root"]'
const SONG_COLOR = 'rgb(32, 64, 96)'

interface Frame {
  ms: number
  layers: number
  /** Opacity of the topmost (newest) background layer */
  topOpacity: number
  topColor: string
}

test.describe('Background changes dissolve', () => {
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

  test("a verse after a song with its own background dissolves into the screen's", async ({
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
    await expect(background).toHaveCount(1)
    await expect(background).toHaveCSS('background-color', SONG_COLOR)
    // The song's background has dissolved in over the empty screen's
    await expect(
      page.locator(`${ROOT} [data-testid="screen-background-layer"]`),
    ).toHaveCount(1)

    const frames = await page.evaluate(
      (root) =>
        new Promise<Frame[]>((resolve, reject) => {
          const frames: Frame[] = []
          const start = performance.now()
          const sample = () => {
            const layers = [
              ...document.querySelectorAll<HTMLElement>(
                `${root} [data-testid="screen-background-layer"]`,
              ),
            ]
            const top = layers[layers.length - 1]
            const ms = performance.now() - start
            frames.push({
              ms,
              layers: layers.length,
              topOpacity: Number(getComputedStyle(top).opacity),
              topColor: getComputedStyle(
                top.querySelector('[data-testid="screen-background"]') ?? top,
              ).backgroundColor,
            })
            const dissolved = frames.some((frame) => frame.layers > 1)
            if (dissolved && layers.length === 1) resolve(frames)
            else if (ms > 4000)
              reject(new Error('the background never changed'))
            else requestAnimationFrame(sample)
          }
          fetch('/api/presentation/temporary-bible', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              verseId: 9100,
              reference: 'Ioan 3:16',
              text: 'Fiindcă atât de mult a iubit Dumnezeu lumea.',
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
      ROOT,
    )

    const dissolving = frames.filter((frame) => frame.layers > 1)
    const last = frames[frames.length - 1]
    test.info().annotations.push({
      type: 'dissolve',
      description: JSON.stringify({
        ms: dissolving[dissolving.length - 1].ms - dissolving[0].ms,
        frames: dissolving.length,
      }),
    })

    // The new background eases in over the old one, never jumping back.
    expect(
      dissolving.some((f) => f.topOpacity > 0.2 && f.topOpacity < 0.8),
    ).toBe(true)
    for (let i = 1; i < dissolving.length; i++) {
      expect(dissolving[i].topOpacity).toBeGreaterThanOrEqual(
        dissolving[i - 1].topOpacity,
      )
    }
    // Over the slide's own handoff (~800 ms), not a cut and not a drag.
    const dissolveMs = dissolving[dissolving.length - 1].ms - dissolving[0].ms
    expect(dissolveMs).toBeGreaterThan(500)
    expect(dissolveMs).toBeLessThan(1200)
    // Then only the screen's background is left, fully opaque.
    expect(last.topOpacity).toBe(1)
    expect(last.topColor).not.toBe(SONG_COLOR)
  })
})
