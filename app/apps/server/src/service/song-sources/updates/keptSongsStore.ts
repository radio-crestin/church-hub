import { htmlToPlainText, type SourceSong } from '@church-hub/song-formats'

import { readSourceCache, writeSourceCache } from './sourceCacheFile'

/** A library song the user kept as it is over this version of the source's. */
interface KeptSong {
  songId: number
  /** The source's lyrics the user turned down (see lyricsKey). */
  lyrics: string
}

/** Lyrics as words only, so markup differences never count as a change. */
export const lyricsText = (html: string) =>
  htmlToPlainText(html).replace(/\s+/g, ' ').trim()

/** A short key of a source song's lyrics, as words only. */
export const lyricsKey = (song: SourceSong) =>
  Bun.hash(
    lyricsText(song.parsed.slides.map((s) => s.htmlContent).join(' ')),
  ).toString(36)

export function readKeptSongs(sourceId: string): KeptSong[] {
  return readSourceCache<KeptSong>('kept', sourceId)
}

/**
 * Remembers that the user keeps these library songs over the source's
 * versions, so the next checks offer them again only when the source
 * changes them once more.
 */
export function saveKeptSongs(
  sourceId: string,
  kept: { songId: number; song: SourceSong }[],
): void {
  const ids = new Set(kept.map((k) => k.songId))
  writeSourceCache('kept', sourceId, [
    ...readKeptSongs(sourceId).filter((k) => !ids.has(k.songId)),
    ...kept.map(({ songId, song }) => ({ songId, lyrics: lyricsKey(song) })),
  ])
}
