import { expect, test } from '@playwright/test'

import { checksTimingBudgets } from './helpers/timing-budgets'

/**
 * A background change goes with the text, in a clean dip: a song with its
 * own background, then a verse on the screen's background. The song's text
 * and background fade out together; then the verse and the screen's
 * background fade in together. Old and new never show at once.
 */

/** The projection, and the operator's live preview of it (Bible page). */
const SURFACES = [
  { name: 'the projection', root: '[data-testid="screen-renderer-root"]' },
  { name: "the operator's preview", root: '[data-testid="live-preview"]' },
]
const SONG_COLOR = 'rgb(32, 64, 96)'
const VERSE = 'Fiindcă atât de mult a iubit Dumnezeu lumea.'

interface Frame {
  ms: number
  song: number
  verse: number
  layers: number
  /** Opacity of the song's background layer (0 once it is gone) */
  oldBackground: number
  /** Opacity of the screen's background layer (0 before it comes) */
  newBackground: number
}

test.describe('Background changes go with the text', () => {
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

  for (const { name, root: ROOT } of SURFACES) {
    test(`a verse after a song with its own background, on ${name}: out together, then in together`, async ({
      page,
      request,
    }) => {
      await request.post('/api/presentation/stop')
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(
        ROOT.includes('live-preview') ? '/bible' : `/screen/${screenId}`,
      )
      await expect(page.locator(ROOT)).toBeVisible()

      await request.post('/api/presentation/temporary-song', {
        data: { songId, slideIndex: 0 },
      })
      const background = page.locator(
        `${ROOT} [data-testid="screen-background"]`,
      )
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
                ...(document
                  .querySelector(root)
                  ?.querySelectorAll<HTMLElement>('[data-style-anchor]') ?? []),
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
              ].map((layer) => ({
                opacity: Number(getComputedStyle(layer).opacity),
                color: getComputedStyle(
                  layer.querySelector('[data-testid^="screen-background"]') ??
                    layer,
                ).backgroundColor,
              }))
              const opacityOf = (old: boolean) =>
                Math.max(
                  0,
                  ...layers
                    .filter((layer) => (layer.color === songColor) === old)
                    .map((layer) => layer.opacity),
                )
              const frame = {
                ms: performance.now() - start,
                song: textOpacity(lyric),
                verse: textOpacity(verse),
                layers: layers.length,
                oldBackground: opacityOf(true),
                newBackground: opacityOf(false),
              }
              frames.push(frame)
              const settled =
                frame.verse >= 0.999 &&
                frame.layers === 1 &&
                frame.oldBackground === 0
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

      const songLeaves = frames.find((f) => f.song < 0.98)
      const backgroundLeaves = frames.find((f) => f.oldBackground < 0.98)
      const verseStarts = frames.find((f) => f.verse > 0.02)
      const backgroundStarts = frames.find((f) => f.newBackground > 0.02)
      const verseDone = frames.find((f) => f.verse >= 0.999)
      const backgroundDone = frames.find((f) => f.newBackground >= 0.999)
      if (
        !songLeaves ||
        !backgroundLeaves ||
        !verseStarts ||
        !backgroundStarts ||
        !verseDone ||
        !backgroundDone
      ) {
        throw new Error('the song did not leave, or the verse did not come in')
      }
      test.info().annotations.push({
        type: 'sync',
        description: JSON.stringify({
          songLeaves: songLeaves.ms,
          backgroundLeaves: backgroundLeaves.ms,
          verseStarts: verseStarts.ms,
          backgroundStarts: backgroundStarts.ms,
          verseDone: verseDone.ms,
          backgroundDone: backgroundDone.ms,
        }),
      })

      // Out together: the song's background fades with the song, in step.
      if (checksTimingBudgets) {
        expect(Math.abs(songLeaves.ms - backgroundLeaves.ms)).toBeLessThan(50)
      }
      for (const frame of frames.filter(
        (f) => f.song > 0.02 && f.song < 0.98,
      )) {
        expect(Math.abs(frame.oldBackground - frame.song)).toBeLessThan(0.35)
      }
      // Never old and new at once: nothing new while anything old shows.
      for (const frame of frames) {
        const old = Math.max(frame.song, frame.oldBackground)
        const next = Math.max(frame.verse, frame.newBackground)
        expect(old > 0.02 && next > 0.02, `at ${frame.ms} ms`).toBe(false)
      }
      // In together: the screen's background and the verse start and settle
      // within three frames (a loaded machine delays the text by a frame).
      if (checksTimingBudgets) {
        expect(Math.abs(verseStarts.ms - backgroundStarts.ms)).toBeLessThan(50)
        expect(Math.abs(verseDone.ms - backgroundDone.ms)).toBeLessThan(50)
      }
      for (const frame of frames.filter(
        (f) => f.verse > 0.02 && f.verse < 0.98,
      )) {
        expect(Math.abs(frame.newBackground - frame.verse)).toBeLessThan(0.35)
      }
    })
  }
})
