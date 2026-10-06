import { isOnline } from './isOnline'
import { getAutoUpdateSongs } from './sourceUpdatesStore'
import { createLogger } from '../../../utils/logger'
import { clearSearchCache } from '../../songs'

const logger = createLogger('song-updates')

/** A bit after start, so opening the app comes first. */
const START_DELAY_MS = 30_000
const DAILY_MS = 24 * 60 * 60 * 1000

interface Run {
  done: Promise<void>
  /** Stops the worker; what it saved so far stays. */
  stop: () => void
}

let current: Run | null = null

/**
 * The worker's file. In the compiled sidecar every worker is an entrypoint
 * of its own (scripts/workerEntrypoints.ts), found by its path from src/;
 * from source, it is the file next to this one.
 */
function workerSpecifier(): string | URL {
  const compiled = Bun.main.includes('$bunfs') || Bun.main.includes('~BUN')
  return compiled
    ? './service/song-sources/updates/songUpdatesWorker.ts'
    : new URL('./songUpdatesWorker.ts', import.meta.url)
}

export function isSongUpdatesRunning(): boolean {
  return current !== null
}

/**
 * Runs the song updates in a worker thread (see songUpdatesWorker.ts), one
 * run at a time: a second request while one runs waits for it.
 */
export function runSongUpdatesInWorker(
  options: { force?: boolean; sourceIds?: string[] } = {},
): Promise<void> {
  if (current) return current.done
  const worker = new Worker(workerSpecifier())
  let stop = () => {}
  const done = new Promise<void>((resolve) => {
    stop = () => {
      worker.terminate()
      // Songs added from the worker: searches must see them.
      clearSearchCache()
      current = null
      resolve()
    }
    worker.onmessage = (event: MessageEvent) => {
      if (event.data?.type === 'failed') {
        logger.error(`Song updates failed: ${event.data.error}`)
      }
      stop()
    }
    worker.onerror = (event) => {
      logger.error(`Song updates worker: ${event.message}`)
      stop()
    }
  })
  current = { done, stop }
  worker.postMessage({
    force: options.force ?? false,
    autoUpdate: getAutoUpdateSongs(),
    sourceIds: options.sourceIds,
  })
  return done
}

/** Stops the running check; false when none runs. */
export function cancelSongUpdates(): boolean {
  if (!current) return false
  logger.info('Song updates cancelled by the user')
  current.stop()
  return true
}

/** A scheduled check starts only online; offline it quietly waits for the next. */
async function runScheduled(): Promise<void> {
  if (!(await isOnline())) {
    logger.info('No internet connection: the song sources are checked later')
    return
  }
  await runSongUpdatesInWorker()
}

/**
 * Checks the song sources a bit after start, then daily. Off when
 * CHURCH_HUB_SONG_UPDATES_AT_START is "false" (the e2e server: tests start
 * the runs they need).
 */
export function startSongUpdates(): void {
  if (process.env.CHURCH_HUB_SONG_UPDATES_AT_START === 'false') return
  setTimeout(() => void runScheduled(), START_DELAY_MS)
  setInterval(() => void runScheduled(), DAILY_MS)
}
