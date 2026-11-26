import { existsSync } from 'node:fs'

import { midiAudioPath, midiFilePath } from './midiStore'
import { SOUND_FONT_PATH } from './soundFontPath'
import type { RenderMidiJob } from './types'
import { createLogger } from '../../utils/logger'

const logger = createLogger('midi-audio')

const rendering = new Map<string, Promise<string>>()

/**
 * The worker's file. In the compiled sidecar every worker is an entrypoint
 * of its own (scripts/workerEntrypoints.ts), found by its path from src/;
 * from source, it is the file next to this one.
 */
function workerSpecifier(): string | URL {
  const compiled = Bun.main.includes('$bunfs') || Bun.main.includes('~BUN')
  return compiled
    ? './service/midi-audio/renderMidiWorker.ts'
    : new URL('./renderMidiWorker.ts', import.meta.url)
}

function renderInWorker(job: RenderMidiJob): Promise<void> {
  const worker = new Worker(workerSpecifier())
  return new Promise<void>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent) => {
      worker.terminate()
      if (event.data?.type === 'done') resolve()
      else reject(new Error(event.data?.error ?? 'MIDI render failed'))
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message))
    }
    worker.postMessage(job)
  })
}

/**
 * The MIDI file's audio as a WAV the audio player can play: rendered once,
 * then cached next to the file. A render asked for twice runs once.
 */
export function renderMidiAudio(hash: string): Promise<string> {
  const outPath = midiAudioPath(hash)
  if (existsSync(outPath)) return Promise.resolve(outPath)
  const running = rendering.get(hash)
  if (running) return running

  const started = Date.now()
  const job = renderInWorker({
    midiPath: midiFilePath(hash),
    soundFontPath: SOUND_FONT_PATH,
    outPath,
  })
    .then(() => {
      logger.info(
        `Rendered MIDI ${hash.slice(0, 8)} in ${Date.now() - started} ms`,
      )
      return outPath
    })
    .finally(() => rendering.delete(hash))
  rendering.set(hash, job)
  return job
}
