import type { LibraryShare, LibraryShareInput } from './types'
import { getRawDatabase } from '../../../db'

interface ShareRow {
  id: number
  source_id: string
  name: string
  publisher: string
  category_ids: string | null
  listed: number
  manifest_url: string | null
  published_checksum: string | null
  published_shards: string | null
  song_count: number
  last_synced_at: number | null
  last_error: string | null
}

const toShare = (row: ShareRow): LibraryShare => ({
  id: row.id,
  sourceId: row.source_id,
  name: row.name,
  publisher: row.publisher,
  categoryIds: row.category_ids ? JSON.parse(row.category_ids) : null,
  listed: row.listed === 1,
  manifestUrl: row.manifest_url,
  publishedChecksum: row.published_checksum,
  publishedShards: row.published_shards ? JSON.parse(row.published_shards) : [],
  songCount: row.song_count,
  lastSyncedAt: row.last_synced_at,
  lastError: row.last_error,
})

/** The church's share, or null while it shares nothing. One per church. */
export function getShare(): LibraryShare | null {
  const row = getRawDatabase()
    .query<ShareRow, []>(
      'SELECT * FROM song_library_shares ORDER BY id LIMIT 1',
    )
    .get()
  return row ? toShare(row) : null
}

/** Creates the share (with its folder) or changes what it shares. */
export function upsertShare(
  input: LibraryShareInput & { publisher: string },
  newSourceId: () => string,
): LibraryShare {
  const db = getRawDatabase()
  const existing = getShare()
  const categoryIds = input.categoryIds
    ? JSON.stringify(input.categoryIds)
    : null
  if (existing) {
    db.query(
      `UPDATE song_library_shares SET name = ?, publisher = ?, category_ids = ?, listed = ?
       WHERE id = ?`,
    ).run(
      input.name,
      input.publisher,
      categoryIds,
      input.listed ? 1 : 0,
      existing.id,
    )
  } else {
    db.query(
      `INSERT INTO song_library_shares (source_id, name, publisher, category_ids, listed)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      newSourceId(),
      input.name,
      input.publisher,
      categoryIds,
      input.listed ? 1 : 0,
    )
  }
  const share = getShare()
  if (!share) throw new Error('Could not save the share')
  return share
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
