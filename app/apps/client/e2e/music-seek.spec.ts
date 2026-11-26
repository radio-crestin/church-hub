import { expect, type Page, test } from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'
import { startFakeAudioServer } from './helpers/fake-audio'
import { FAKE_AUDIO_PORT } from '../playwright.config'

/**
 * Seeking in the Music player (T-904): a drag along the progress bar seeks
 * once, where it ends, not at every second it passes (each of those seeks
 * made the desktop player jump and click). While dragging, the time shows
 * where the drag is; after, playing goes on from there. The stand-in audio
 * server (helpers/fake-audio-server.ts) lists the commands it gets.
 *
 * How a seek sounds (a fade out, the exact new position, a fade in) is
 * guarded by the desktop app's own tests: app/tauri/src/audio/smooth_seek.rs.
 */

const TRACK_SECONDS = 180 // the stand-in's track length

let stopFakeAudio: (() => void) | undefined
test.beforeAll(async () => {
  stopFakeAudio = await startFakeAudioServer()
})
test.afterAll(() => stopFakeAudio?.())

async function seeksSent(page: Page): Promise<number[]> {
  const response = await page.request.get(
    `http://127.0.0.1:${FAKE_AUDIO_PORT}/calls`,
  )
  const calls = (await response.json()) as {
    path: string
    body: { time?: number }
  }[]
  return calls.filter((call) => call.path === '/seek').map((c) => c.body.time!)
}

const seconds = (shown: string) => {
  const [minutes, secs] = shown.split(':').map(Number)
  return minutes * 60 + secs
}

test('a drag along the progress bar seeks once, where it ends', async ({
  page,
}) => {
  await setAppLanguage(page, 'en')
  await page.goto('/music')
  const track = page.getByTestId('music-track-row').first()
  await expect(track).toBeVisible({ timeout: 20_000 })
  await track.click()
  await expect(track).toHaveAttribute('data-playing', 'true')

  const bar = page.getByTestId('music-progress')
  const time = page.getByTestId('music-current-time')
  await expect(bar).toHaveAttribute('max', String(TRACK_SECONDS))
  const box = (await bar.boundingBox())!
  const y = box.y + box.height / 2
  const seeksBefore = (await seeksSent(page)).length

  // Across most of the track, through dozens of seconds.
  await page.mouse.move(box.x + box.width * 0.1, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.5, y, { steps: 15 })
  // Mid-drag the time follows the thumb, and nothing was sought yet.
  await expect
    .poll(async () => seconds(await time.innerText()))
    .toBeGreaterThan(70)
  await page.mouse.move(box.x + box.width * 0.8, y, { steps: 15 })
  expect((await seeksSent(page)).length).toBe(seeksBefore)
  await page.mouse.up()

  await expect
    .poll(async () => (await seeksSent(page)).length)
    .toBe(seeksBefore + 1)
  const target = (await seeksSent(page)).at(-1)!
  expect(target).toBeGreaterThan(TRACK_SECONDS * 0.7)
  expect(target).toBeLessThan(TRACK_SECONDS * 0.9)

  // Playing goes on from there, and the thumb never snaps back.
  for (let i = 0; i < 4; i++) {
    const shown = seconds(await time.innerText())
    expect(shown).toBeGreaterThanOrEqual(target)
    expect(shown).toBeLessThan(target + 5)
    await page.waitForTimeout(400)
  }

  // From the keyboard, each step is a seek of its own.
  await bar.focus()
  await bar.press('ArrowRight')
  await expect
    .poll(async () => (await seeksSent(page)).length)
    .toBe(seeksBefore + 2)
})
