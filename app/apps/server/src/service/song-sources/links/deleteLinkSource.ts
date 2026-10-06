import { getRawDatabase } from '../../../db'

/** Removes a source added from a link, and the songs cached from it. */
export function deleteLinkSource(id: string): void {
  const db = getRawDatabase()
  const row = db
    .query<{ url: string }, [string]>(
      'SELECT url FROM song_source_subscriptions WHERE id = ?',
    )
    .get(id)
  if (!row) return
  db.query('DELETE FROM song_source_song_cache WHERE manifest_url = ?').run(
    row.url,
  )
  db.query('DELETE FROM song_source_subscriptions WHERE id = ?').run(id)
}
