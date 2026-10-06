import { getAutoUpdateSongs } from './sourceUpdatesStore'
import { createLogger } from '../../../utils/logger'
import { clearSearchCache } from '../../songs'

const logger = createLogger('song-updates')

/** A bit after start, so opening the app comes first. */
const START_DELAY_MS = 30_000
const DAILY_MS = 24 * 60 * 60 * 1000

let running: Promise<void> | null = null

export function isSongUpdatesRunning(): boolean {
  return running !== null
}

/**
 * Runs the song updates in a worker thread (see songUpdatesWorker.ts), one
 * run at a time: a second request while one runs waits for it.
 */
export function runSongUpdatesInWorker(
  options: { force?: boolean; sourceIds?: string[] } = {},
): Promise<void> {
  if (running) return running
  const worker = new Worker(new URL('./songUpdatesWorker.ts', import.meta.url))
  running = new Promise<void>((resolve) => {
    const finish = () => {
      worker.terminate()
      running = null
      resolve()
    }
    worker.onmessage = (event: MessageEvent) => {
      if (event.data?.type === 'failed') {
        logger.error(`Song updates failed: ${event.data.error}`)
      }
      // Songs added from the worker: searches must see them.
      if (event.data?.imported > 0) clearSearchCache()
      finish()
    }
    worker.onerror = (event) => {
      logger.error(`Song updates worker: ${event.message}`)
      finish()
    }
  })
  worker.postMessage({
    force: options.force ?? false,
    autoUpdate: getAutoUpdateSongs(),
    sourceIds: options.sourceIds,
  })
  return running
}

/**
 * Checks the song sources a bit after start, then daily. Off when
 * CHURCH_HUB_SONG_UPDATES_AT_START is "false" (the e2e server: tests start
 * the runs they need).
 */
export function startSongUpdates(): void {
  if (process.env.CHURCH_HUB_SONG_UPDATES_AT_START === 'false') return
  setTimeout(() => void runSongUpdatesInWorker(), START_DELAY_MS)
  setInterval(() => void runSongUpdatesInWorker(), DAILY_MS)
}
