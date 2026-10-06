import { htmlToPlainText, type SourceSong } from '@church-hub/song-formats'

import { getRawDatabase } from '../../../db'
import type { DiscoveryMatchResult } from '../../songs'

const CHUNK = 500

/** A library song and the source's newer version of it. */
export interface ChangedSong {
  songId: number
  song: SourceSong
}

/** Lyrics as words only, so markup differences never count as a change. */
const lyricsText = (html: string) =>
  htmlToPlainText(html).replace(/\s+/g, ' ').trim()

interface LibrarySong {
  id: number
  title: string
  last_manual_edit: number | null
  lyrics: string
}

function readLibrarySongs(ids: number[]): Map<number, LibrarySong> {
  const db = getRawDatabase()
  const songs = new Map<number, LibrarySong>()
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const marks = chunk.map(() => '?').join(',')
    const rows = db
      .query(
        `SELECT id, title, last_manual_edit FROM songs WHERE id IN (${marks})`,
      )
      .all(...chunk) as Omit<LibrarySong, 'lyrics'>[]
    for (const row of rows) songs.set(row.id, { ...row, lyrics: '' })
    const slides = db
      .query(
        `SELECT song_id, content FROM song_slides WHERE song_id IN (${marks}) ORDER BY song_id, sort_order`,
      )
      .all(...chunk) as { song_id: number; content: string }[]
    for (const slide of slides) {
      const song = songs.get(slide.song_id)
      if (song) song.lyrics += ` ${slide.content}`
    }
  }
  return songs
}

/**
 * Each source song and the library song that came from the same file. A
 * library song several source songs claim is left out: updating it from each
 * in turn would never settle.
 */
function sameFileMatches(
  verdicts: DiscoveryMatchResult[],
): Map<string, number> {
  const fromFile = verdicts.filter(
    (v) => v.verdict === 'exact-filename' && v.exactSongId != null,
  )
  const claims = new Map<number, number>()
  for (const v of fromFile) {
    const id = v.exactSongId as number
    claims.set(id, (claims.get(id) ?? 0) + 1)
  }
  return new Map(
    fromFile
      .filter((v) => claims.get(v.exactSongId as number) === 1)
      .map((v) => [v.tempId, v.exactSongId as number]),
  )
}

/**
 * The source's songs whose lyrics changed since the library got them, for
 * the library songs nobody edited by hand: a song the user changed is never
 * replaced. Only a library song from the same file, under the same title, so
 * an update always lands on the song it came from, never on another song
 * that only shares its title.
 */
export function findChangedSongs(
  songs: SourceSong[],
  verdicts: DiscoveryMatchResult[],
): ChangedSong[] {
  const exact = sameFileMatches(verdicts)
  if (exact.size === 0) return []
  const library = readLibrarySongs([...new Set(exact.values())])
  return songs.flatMap((song) => {
    const id = exact.get(song.id)
    const known = id == null ? undefined : library.get(id)
    if (!known || known.last_manual_edit) return []
    if (known.title.toLowerCase() !== song.parsed.title.toLowerCase()) {
      return []
    }
    const fresh = song.parsed.slides.map((s) => s.htmlContent).join(' ')
    if (lyricsText(fresh) === lyricsText(known.lyrics)) return []
    return [{ songId: known.id, song }]
  })
}
