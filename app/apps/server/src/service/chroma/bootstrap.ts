import { resetChromaCollections } from './client'
import {
  setChromaUnexpectedExitHandler,
  startChromaServer,
} from './serverProcess'
import { getChromaStatus, updateChromaStatus } from './status'
import { awaitFullSyncSettled, fullChromaSync } from './sync'
import { createLogger } from '../../utils/logger'

const logger = createLogger('chroma')

const MAX_CRASH_RESTARTS = 3
let crashRestarts = 0

/**
 * Starts the Chroma engine in the background: spawns the server child
 * process, then runs the SQLite→Chroma full sync (hash-diffed, cheap when
 * already in sync). Never blocks boot — search falls back to SQLite until
 * the engine reports ready. No-op when CHROMA_DISABLED=true.
 */
export async function initializeChroma(): Promise<void> {
  if (process.env.CHROMA_DISABLED === 'true') {
    logger.info('Chroma disabled via CHROMA_DISABLED')
    updateChromaStatus({ state: 'disabled' })
    return
  }
  // Supervise: restart with backoff when the child dies unexpectedly. The
  // full sync after restart is hash-diffed, so recovery is cheap.
  setChromaUnexpectedExitHandler(() => {
    if (crashRestarts >= MAX_CRASH_RESTARTS) {
      logger.error(
        `Chroma crashed ${crashRestarts} times — giving up (POST /api/search/chroma-resync to retry)`,
      )
      return
    }
    crashRestarts++
    const backoffMs = 2_000 * crashRestarts
    logger.warning(
      `Restarting Chroma in ${backoffMs}ms (attempt ${crashRestarts}/${MAX_CRASH_RESTARTS})`,
    )
    setTimeout(() => void initializeChroma(), backoffMs)
  })

  try {
    await startChromaServer()
    // Mark ready before the initial sync so incremental updates queue up
    // instead of being dropped while the (possibly long) first sync runs.
    updateChromaStatus({ state: 'syncing' })
    await fullChromaSync()
    crashRestarts = 0
  } catch (error) {
    logger.error(`Chroma initialization failed: ${error}`)
    updateChromaStatus({ state: 'error', lastError: String(error) })
  }
}

/**
 * Drops all Chroma collections and rebuilds them from SQLite. Used after
 * database import/restore/factory-reset — Chroma data is derived, so a
 * restore only needs the SQLite file plus this resync.
 */
export async function resyncChroma(): Promise<void> {
  if (getChromaStatus().state === 'disabled') return
  logger.info('Resyncing Chroma from SQLite (reset + full sync)')
  // Server may be down (crashed, gave up restarting) — start is idempotent.
  crashRestarts = 0
  await startChromaServer()
  // Let any in-flight full sync settle first — deleting collections under a
  // running sync would fail its upserts and poison its collection handles.
  await awaitFullSyncSettled()
  await resetChromaCollections()
  await fullChromaSync()
}
