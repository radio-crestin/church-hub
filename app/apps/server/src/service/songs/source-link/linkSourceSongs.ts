import { fillContentHashes } from './fillContentHashes'
import { getRawDatabase } from '../../../db'

/** A library song and the source song it is (now) the same as. */
export interface SourceLink {
  songId: number
  sourceSongId: string
}

/**
 * Records that library songs are the source's songs, as the source gave
 * them now: their content hash becomes the source hash, so a later change
 * from the source updates them unless someone changes them here first.
 */
export function linkSourceSongs(sourceId: string, links: SourceLink[]): void {
  if (links.length === 0) return
  fillContentHashes()
  const db = getRawDatabase()
  const link = db.query(
    `UPDATE songs SET source_id = ?, source_song_id = ?, source_hash = content_hash
     WHERE id = ?`,
  )
  db.transaction(() => {
    for (const { songId, sourceSongId } of links) {
      link.run(sourceId, sourceSongId, songId)
    }
  })()
}
