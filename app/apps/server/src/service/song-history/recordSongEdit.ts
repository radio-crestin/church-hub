import { and, desc, eq, notInArray } from 'drizzle-orm'

import { snapshotsEqual } from './snapshotsEqual'
import type { SongEditor, SongHistoryKind, SongSnapshot } from './types'
import { getDatabase } from '../../db'
import { songEditHistory } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('song-history')

/** Oldest entries beyond this many per song are dropped. */
export const MAX_HISTORY_ENTRIES_PER_SONG = 200

interface RecordSongEditInput {
  songId: number
  kind: SongHistoryKind
  editor: SongEditor
  /** The song before the save; null when the song was just created. */
  before: SongSnapshot | null
  after: SongSnapshot
  restoredFromId?: number
}

function pruneOldEntries(songId: number): void {
  const db = getDatabase()
  const keep = db
    .select({ id: songEditHistory.id })
    .from(songEditHistory)
    .where(eq(songEditHistory.songId, songId))
    .orderBy(desc(songEditHistory.id))
    .limit(MAX_HISTORY_ENTRIES_PER_SONG)
    .all()
    .map((row) => row.id)
  db.delete(songEditHistory)
    .where(
      and(
        eq(songEditHistory.songId, songId),
        notInArray(songEditHistory.id, keep),
      ),
    )
    .run()
}

/**
 * Writes one history entry for a song save. A save that changed neither the
 * title nor the slides (a key-line change, say) leaves no entry. Never throws:
 * a history problem must not fail the save itself.
 */
export function recordSongEdit(input: RecordSongEditInput): void {
  try {
    if (input.before && snapshotsEqual(input.before, input.after)) return

    getDatabase()
      .insert(songEditHistory)
      .values({
        songId: input.songId,
        kind: input.kind,
        editedByUserId: input.editor.userId,
        editedByName: input.editor.name,
        beforeSnapshot: input.before ? JSON.stringify(input.before) : null,
        afterSnapshot: JSON.stringify(input.after),
        restoredFromId: input.restoredFromId ?? null,
        createdAt: new Date(),
      })
      .run()
    pruneOldEntries(input.songId)
  } catch (error) {
    logger.error(`Failed to record history for song ${input.songId}: ${error}`)
  }
}
