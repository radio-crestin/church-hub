import { desc, eq } from 'drizzle-orm'

import { toHistorySummary } from './toHistoryEntry'
import type { SongHistoryEntrySummary } from './types'
import { getDatabase } from '../../db'
import { songEditHistory } from '../../db/schema'

/** A song's history, newest first, without the snapshots. */
export function listSongHistory(songId: number): SongHistoryEntrySummary[] {
  return getDatabase()
    .select()
    .from(songEditHistory)
    .where(eq(songEditHistory.songId, songId))
    .orderBy(desc(songEditHistory.id))
    .all()
    .map(toHistorySummary)
}
