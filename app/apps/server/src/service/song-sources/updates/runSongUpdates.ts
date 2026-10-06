import { checkSourceForUpdates } from './checkSourceForUpdates'
import {
  recordSyncedNotification,
  refreshPendingNotification,
} from './songSyncNotifications'
import { getStoredSourceUpdates, saveSourceUpdates } from './sourceUpdatesStore'
import type { SongUpdatesRun, SourceSongChanges, SourceUpdate } from './types'
import { createLogger } from '../../../utils/logger'
import { listSongSources } from '../listSongSources'

const logger = createLogger('song-updates')

/** A source that could not be checked keeps its last result, with the error. */
function failedCheck(
  sourceId: string,
  name: string,
  last: SourceUpdate | undefined,
  error: unknown,
): SourceUpdate {
  return {
    sourceId,
    name,
    checksum: last?.checksum ?? '',
    newCount: last?.newCount ?? 0,
    similarCount: last?.similarCount ?? 0,
    changedCount: last?.changedCount ?? 0,
    imported: 0,
    updated: 0,
    checkedAt: last?.checkedAt ?? 0,
    error: String(error),
  }
}

/**
 * Checks every song source, one at a time. As soon as each is known, it
 * saves the result and tells the user, in the notifications, what it synced
 * or what waits for their approval. Returns how many songs it added or
 * updated.
 */
export async function runSongUpdates(run: SongUpdatesRun): Promise<number> {
  const started = performance.now()
  const all = listSongSources()
  const updates = new Map(
    getStoredSourceUpdates()
      .filter((u) => all.some((s) => s.id === u.sourceId))
      .map((u) => [u.sourceId, u]),
  )
  const sources = run.sourceIds
    ? all.filter((source) => run.sourceIds?.includes(source.id))
    : all
  const synced: SourceSongChanges[] = []
  const notificationId = `songs-synced:${Date.now()}`
  for (const source of sources) {
    const sourceStarted = performance.now()
    const last = updates.get(source.id)
    try {
      const { update, changes } = await checkSourceForUpdates(source, last, run)
      synced.push(changes)
      updates.set(source.id, update)
    } catch (error) {
      logger.warning(`${source.name}: ${error}`)
      updates.set(source.id, failedCheck(source.id, source.name, last, error))
    }
    saveSourceUpdates([...updates.values()])
    recordSyncedNotification(notificationId, synced)
    refreshPendingNotification()
    logger.info(
      `${source.name}: ${(performance.now() - sourceStarted).toFixed(0)} ms`,
    )
  }
  const changed = synced.reduce(
    (sum, s) => sum + s.added.count + s.updated.count,
    0,
  )
  logger.info(
    `Checked ${sources.length} sources in ${(performance.now() - started).toFixed(0)} ms, added or updated ${changed} songs`,
  )
  return changed
}
