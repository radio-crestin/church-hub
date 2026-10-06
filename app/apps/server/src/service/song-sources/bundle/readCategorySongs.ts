import type { SongBundleSlide, SongBundleSong } from './types'
import { getRawDatabase } from '../../../db'
import { parseAlternateTitles } from '../../songs/parseAlternateTitles'

interface SongRow {
  id: number
  uuid: string
  title: string
  alternate_titles: string | null
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
  presentation_order: string | null
}

interface SlideRow {
  song_id: number
  content: string
  label: string | null
}

/** Every song of a category with its slides, in bundle form. */
export function readCategorySongs(categoryId: number): SongBundleSong[] {
  const db = getRawDatabase()
  const songRows = db
    .query<SongRow, [number]>(
      `SELECT id, uuid, title, alternate_titles, source_filename, author,
              copyright, ccli, tempo, time_signature, theme, alt_theme,
              hymn_number, key_line, presentation_order
         FROM songs WHERE category_id = ? ORDER BY title, id`,
    )
    .all(categoryId)
  const slideRows = db
    .query<SlideRow, [number]>(
      `SELECT sl.song_id, sl.content, sl.label
         FROM song_slides sl JOIN songs s ON s.id = sl.song_id
        WHERE s.category_id = ? ORDER BY sl.song_id, sl.sort_order, sl.id`,
    )
    .all(categoryId)

  const slidesBySong = new Map<number, SongBundleSlide[]>()
  for (const row of slideRows) {
    const slides = slidesBySong.get(row.song_id) ?? []
    slides.push({ content: row.content, label: row.label })
    slidesBySong.set(row.song_id, slides)
  }

  return songRows.map((row) => ({
    // uuid is the song's identity across devices; the local id is the
    // fallback for a row the sync engine has not stamped yet.
    id: row.uuid || `song-${row.id}`,
    title: row.title,
    alternateTitles: parseAlternateTitles(row.alternate_titles),
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
    presentationOrder: row.presentation_order,
    slides: slidesBySong.get(row.id) ?? [],
  }))
}
