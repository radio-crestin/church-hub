import { getRawDatabase } from '../../../db'
import type { SongSource, SongSourceFormat } from '../types'

interface LinkRow {
  id: string
  name: string
  category_name: string
  format: SongSourceFormat
  url: string
}

/** Sources the user added from someone's shared link, oldest first. */
export function listLinkSources(): SongSource[] {
  return getRawDatabase()
    .query<LinkRow, []>(
      `SELECT id, name, category_name, format, url
         FROM song_source_subscriptions ORDER BY created_at, name`,
    )
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      categoryName: row.category_name,
      format: row.format,
      url: row.url,
      origin: 'link',
    }))
}
