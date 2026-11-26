import { runSyncCycle } from './runSyncCycle'
import { getSyncConfig } from './syncConfigStore'
import { getRawDatabase } from '../../db'
import { createLogger } from '../../utils/logger'

const logger = createLogger('sync')

/** How often the scheduler wakes to decide whether a sync cycle is due. */
const CHECK_INTERVAL_MS = 5 * 1000

/**
 * Local edits are pushed once the user has been idle this long: a Drive
 * upload rewrites the whole library, a cloud write sends only the diff, so
 * the cloud publishes edits almost as they happen.
 */
const DEBOUNCE_SECONDS = { drive: 15, cloud: 2 } as const

/**
 * The cloud polls head.json this often: a GET from the bucket, a 304 when
 * nothing changed. Drive polls every `pollIntervalMinutes`.
 */
const CLOUD_POLL_SECONDS = 30

/** Delay before the on-startup sync, letting the app finish booting first. */
const STARTUP_DELAY_MS = 10 * 1000

/** After a failed cycle, wait this long before trying again. */
const RETRY_AFTER_FAILURE_MS = 60 * 1000

let timer: ReturnType<typeof setInterval> | null = null
let retryAt = 0
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
    (pending?.newest ?? 0) <= nowSeconds - DEBOUNCE_SECONDS[config.transport]
  const pollIntervalMs =
    config.transport === 'cloud'
      ? CLOUD_POLL_SECONDS * 1000
      : config.pollIntervalMinutes * 60 * 1000
  const pollDue = Date.now() - (config.lastSyncAt ?? 0) > pollIntervalMs

  if (!hasSettledEdits && !pollDue) return
  if (Date.now() < retryAt) return

  const result = await runSyncCycle()
  if (!result.success && !result.skipped) {
    retryAt = Date.now() + RETRY_AFTER_FAILURE_MS
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
