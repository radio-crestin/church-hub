import { eq, sql } from 'drizzle-orm'

import { getDatabase } from '../../db'
import { musicFiles } from '../../db/schema'

/** Counts a track's start, for its play count and "last played". */
export function recordPlay(fileId: number): void {
  getDatabase()
    .update(musicFiles)
    .set({
      playCount: sql`${musicFiles.playCount} + 1`,
      lastPlayedAt: new Date(),
    })
    .where(eq(musicFiles.id, fileId))
    .run()
}
