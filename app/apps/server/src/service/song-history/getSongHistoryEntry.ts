import { and, eq } from 'drizzle-orm'

import { toHistoryEntry } from './toHistoryEntry'
import type { SongHistoryEntry } from './types'
import { getDatabase } from '../../db'
import { songEditHistory } from '../../db/schema'

/** One history entry of a song with its before/after snapshots, or null. */
export function getSongHistoryEntry(
  songId: number,
  entryId: number,
): SongHistoryEntry | null {
  const record = getDatabase()
    .select()
    .from(songEditHistory)
    .where(
      and(eq(songEditHistory.songId, songId), eq(songEditHistory.id, entryId)),
    )
    .get()
  return record ? toHistoryEntry(record) : null
}
