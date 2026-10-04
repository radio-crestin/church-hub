import { execFile } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { basename } from 'node:path'
import { promisify } from 'node:util'
import { type Page, test } from '@playwright/test'

/**
 * Voice-over for demo videos: each caption is read aloud by macOS `say` into
 * a clip next to the test's video, and listed in voice-cues.tsv as
 * "<ms since the video started>\t<clip file>". record-features.sh sets
 * DEMO_VOICE=1 and mixes the clips into the mp4 at those times.
 * Pick another voice with DEMO_VOICE_NAME (e.g. Ioana for Romanian).
 */

// Async on purpose: Playwright receives the video frames in this process, so
// a blocking call would freeze the video while the voice is made.
const run = promisify(execFile)
const videoStart = new WeakMap<Page, number>()

/** Notes when the page (and so its video) started; call it right after the page is created. */
export function startVoiceClock(page: Page): void {
  videoStart.set(page, Date.now())
}

/** With DEMO_VOICE set, records the caption read aloud and returns how long it lasts, in ms. */
export async function speakCaption(page: Page, text: string): Promise<number> {
  if (!process.env.DEMO_VOICE || !text) return 0
  const start = videoStart.get(page)
  if (start === undefined) {
    throw new Error('speakCaption: call installDemoOverlay(page) first')
  }
  const atMs = Date.now() - start
  const clip = test.info().outputPath(`voice-${atMs}.aiff`)
  const voice = process.env.DEMO_VOICE_NAME ?? 'Samantha'
  await run('say', ['-v', voice, '-o', clip, text], { timeout: 30000 })
  appendFileSync(
    test.info().outputPath('voice-cues.tsv'),
    `${atMs}\t${basename(clip)}\n`,
  )
  return clipDurationMs(clip)
}

async function clipDurationMs(clip: string): Promise<number> {
  const { stdout } = await run(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', clip],
    { timeout: 10000 },
  )
  return Math.round(Number(stdout) * 1000)
}
