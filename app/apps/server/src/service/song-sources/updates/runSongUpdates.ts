import { checkSourceForUpdates } from './checkSourceForUpdates'
import { getStoredSourceUpdates, saveSourceUpdates } from './sourceUpdatesStore'
import type { SongUpdatesRun, SourceUpdate } from './types'
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
    imported: 0,
    checkedAt: last?.checkedAt ?? 0,
    error: String(error),
  }
}

/**
 * Checks every song source, one at a time, saving each result as soon as it
 * is known. Returns how many songs were added.
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
  let imported = 0
  for (const source of sources) {
    const sourceStarted = performance.now()
    const last = updates.get(source.id)
    try {
      const result = await checkSourceForUpdates(source, last, run)
      imported += result.imported
      updates.set(source.id, result)
    } catch (error) {
      logger.warning(`${source.name}: ${error}`)
      updates.set(source.id, failedCheck(source.id, source.name, last, error))
    }
    saveSourceUpdates([...updates.values()])
    logger.info(
      `${source.name}: ${(performance.now() - sourceStarted).toFixed(0)} ms`,
    )
  }
  logger.info(
    `Checked ${sources.length} sources in ${(performance.now() - started).toFixed(0)} ms, added ${imported} songs`,
  )
  return imported
}
