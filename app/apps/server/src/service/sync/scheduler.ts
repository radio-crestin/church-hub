import { runSyncCycle } from './runSyncCycle'
import { getSyncConfig } from './syncConfigStore'
import { getRawDatabase } from '../../db'
import { createLogger } from '../../utils/logger'

const logger = createLogger('sync')

/** How often the scheduler wakes to decide whether a sync cycle is due. */
const CHECK_INTERVAL_MS = 60 * 1000

/** Local edits are pushed once the user has been idle this long. */
const DEBOUNCE_SECONDS = 15

/** Delay before the on-startup sync, letting the app finish booting first. */
const STARTUP_DELAY_MS = 10 * 1000

let timer: ReturnType<typeof setInterval> | null = null
let startupTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Runs a sync cycle when one is due: local edits are pending (and the burst of
 * editing has settled), or the poll interval elapsed since the last sync (to
 * pick up changes made on other devices). No-op while sync is disabled.
 */
export async function runScheduledSyncIfDue(): Promise<void> {
  const config = await getSyncConfig()
  if (!config.syncEnabled) return

  const db = getRawDatabase()
  const pending = db
    .query<{ count: number; newest: number | null }, []>(
      'SELECT COUNT(*) AS count, MAX(queued_at) AS newest FROM sync_pending',
    )
    .get()

  const nowSeconds = Math.floor(Date.now() / 1000)
  const hasSettledEdits =
    (pending?.count ?? 0) > 0 &&
    (pending?.newest ?? 0) <= nowSeconds - DEBOUNCE_SECONDS
  const pollDue =
    Date.now() - (config.lastSyncAt ?? 0) >
    config.pollIntervalMinutes * 60 * 1000

  if (!hasSettledEdits && !pollDue) return

  const result = await runSyncCycle()
  if (!result.success && !result.skipped) {
    logger.warning(`Scheduled sync failed: ${result.error}`)
  }
}

/**
 * Starts the periodic sync scheduler and queues an initial sync shortly after
 * startup (the "import changes made elsewhere when I open the app" moment).
 * Idempotent — calling twice keeps a single timer.
 */
export function startSyncScheduler(): void {
  if (timer) return
  timer = setInterval(() => {
    void runScheduledSyncIfDue()
  }, CHECK_INTERVAL_MS)
  timer.unref?.()

  startupTimer = setTimeout(() => {
    void (async () => {
      const config = await getSyncConfig()
      if (config.syncEnabled) await runSyncCycle()
    })()
  }, STARTUP_DELAY_MS)
  startupTimer.unref?.()

  logger.info('Sync scheduler started')
}

/** Stops the scheduler (used in tests / shutdown). */
export function stopSyncScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (startupTimer) {
    clearTimeout(startupTimer)
    startupTimer = null
  }
}
