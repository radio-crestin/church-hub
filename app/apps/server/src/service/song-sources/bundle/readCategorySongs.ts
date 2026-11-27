import { getRawDatabase } from '../../../db'

export interface CategorySong {
  id: number
  uuid: string
  title: string
  sourceFilename: string | null
  author: string | null
  copyright: string | null
  ccli: string | null
  tempo: string | null
  timeSignature: string | null
  theme: string | null
  altTheme: string | null
  hymnNumber: string | null
  keyLine: string | null
  slides: Array<{ content: string; label: string | null }>
}

interface SongRow {
  id: number
  uuid: string
  title: string
  source_filename: string | null
  author: string | null
  copyright: string | null
  ccli: string | null
  tempo: string | null
  time_signature: string | null
  theme: string | null
  alt_theme: string | null
  hymn_number: string | null
  key_line: string | null
}

interface SlideRow {
  song_id: number
  content: string
  label: string | null
}

/** Which songs: a category's (null: the songs with none), or chosen ones. */
export type CategorySongsFilter =
  | { categoryId: number | null }
  | { songIds: number[] }

/** Songs with their slides in order, two queries in all. */
export function readCategorySongs(filter: CategorySongsFilter): CategorySong[] {
  const db = getRawDatabase()
  const [condition, value] =
    'categoryId' in filter
      ? (['category_id IS ?', filter.categoryId] as const)
      : ([
          'id IN (SELECT value FROM json_each(?))',
          JSON.stringify(filter.songIds),
        ] as const)
  const songRows = db
    .query<SongRow, [number | string | null]>(
      `SELECT id, uuid, title, source_filename, author, copyright, ccli, tempo,
              time_signature, theme, alt_theme, hymn_number, key_line
         FROM songs WHERE ${condition} ORDER BY title, id`,
    )
    .all(value)
  const slideRows = db
    .query<SlideRow, [number | string | null]>(
      `SELECT sl.song_id, sl.content, sl.label
         FROM song_slides sl JOIN songs s ON s.id = sl.song_id
        WHERE s.${condition} ORDER BY sl.song_id, sl.sort_order, sl.id`,
    )
    .all(value)

  const slidesBySong = new Map<number, CategorySong['slides']>()
  for (const row of slideRows) {
    const slides = slidesBySong.get(row.song_id) ?? []
    slides.push({ content: row.content, label: row.label })
    slidesBySong.set(row.song_id, slides)
  }

  return songRows.map((row) => ({
    id: row.id,
    uuid: row.uuid,
    title: row.title,
    sourceFilename: row.source_filename,
    author: row.author,
    copyright: row.copyright,
    ccli: row.ccli,
    tempo: row.tempo,
    timeSignature: row.time_signature,
    theme: row.theme,
    altTheme: row.alt_theme,
    hymnNumber: row.hymn_number,
    keyLine: row.key_line,
    slides: slidesBySong.get(row.id) ?? [],
  }))
}
