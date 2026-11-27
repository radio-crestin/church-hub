import type { LibraryShare, LibraryShareInput } from './types'
import { getRawDatabase } from '../../../db'

interface ShareRow {
  id: number
  source_id: string
  name: string
  publisher: string
  category_ids: string | null
  song_ids: string | null
  listed: number
  manifest_url: string | null
  published_checksum: string | null
  published_shards: string | null
  song_count: number
  last_synced_at: number | null
  last_error: string | null
}

/** The picked songs still in the library, with their titles, by title. */
function pickedSongs(songIds: string | null): LibraryShare['songs'] {
  if (!songIds) return []
  return getRawDatabase()
    .query<{ id: number; title: string }, [string]>(
      `SELECT id, title FROM songs
        WHERE id IN (SELECT value FROM json_each(?)) ORDER BY title, id`,
    )
    .all(songIds)
}

const toShare = (row: ShareRow): LibraryShare => ({
  id: row.id,
  sourceId: row.source_id,
  name: row.name,
  publisher: row.publisher,
  categoryIds: row.category_ids ? JSON.parse(row.category_ids) : null,
  songIds: row.song_ids ? JSON.parse(row.song_ids) : [],
  songs: pickedSongs(row.song_ids),
  listed: row.listed === 1,
  manifestUrl: row.manifest_url,
  publishedChecksum: row.published_checksum,
  publishedShards: row.published_shards ? JSON.parse(row.published_shards) : [],
  songCount: row.song_count,
  lastSyncedAt: row.last_synced_at,
  lastError: row.last_error,
})

/** The church's shares, oldest first; empty while it shares nothing. */
export function listShares(): LibraryShare[] {
  return getRawDatabase()
    .query<ShareRow, []>('SELECT * FROM song_library_shares ORDER BY id')
    .all()
    .map(toShare)
}

/** One share, or null when there is none with this id. */
export function getShare(id: number): LibraryShare | null {
  const row = getRawDatabase()
    .query<ShareRow, [number]>('SELECT * FROM song_library_shares WHERE id = ?')
    .get(id)
  return row ? toShare(row) : null
}

/**
 * Creates a share in a new folder (`sourceId`), or, given its `id`, changes
 * what it shares. Returns its id.
 */
export function upsertShare(
  input: LibraryShareInput & { publisher: string },
  target: { id: number } | { sourceId: string },
): number {
  const db = getRawDatabase()
  const values = [
    input.name,
    input.publisher,
    input.categoryIds ? JSON.stringify(input.categoryIds) : null,
    input.categoryIds ? JSON.stringify(input.songIds) : null,
    input.listed ? 1 : 0,
  ]
  if ('id' in target) {
    db.query(
      `UPDATE song_library_shares
          SET name = ?, publisher = ?, category_ids = ?, song_ids = ?, listed = ?
        WHERE id = ?`,
    ).run(...values, target.id)
    return target.id
  }
  const row = db
    .query<{ id: number }, (string | number | null)[]>(
      `INSERT INTO song_library_shares
         (name, publisher, category_ids, song_ids, listed, source_id)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(...values, target.sourceId)
  if (!row) throw new Error('Could not save the share')
  return row.id
}

/** What a publish did: the manifest now in the bucket, or why it failed. */
export function recordShareSync(
  id: number,
  result:
    | {
        manifestUrl: string
        checksum: string
        shards: string[]
        songCount: number
      }
    | { error: string },
): void {
  const db = getRawDatabase()
  if ('error' in result) {
    db.query('UPDATE song_library_shares SET last_error = ? WHERE id = ?').run(
      result.error,
      id,
    )
    return
  }
  db.query(
    `UPDATE song_library_shares SET manifest_url = ?, published_checksum = ?,
       published_shards = ?, song_count = ?, last_synced_at = ?, last_error = NULL
     WHERE id = ?`,
  ).run(
    result.manifestUrl,
    result.checksum,
    JSON.stringify(result.shards),
    result.songCount,
    Date.now(),
    id,
  )
}

export function deleteShareRow(id: number): void {
  getRawDatabase().query('DELETE FROM song_library_shares WHERE id = ?').run(id)
}
