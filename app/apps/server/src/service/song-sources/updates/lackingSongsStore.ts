import type { SourceSong } from '@church-hub/song-formats'

import { readSourceCache, writeSourceCache } from './sourceCacheFile'
import { keepNotInLibrary, type SongVersionSuggestion } from '../../songs'

/** A song of a source the library lacks, as the last check classified it. */
export interface LackingSong extends SourceSong {
  /** 'similar': the library has a version of it under another title. */
  verdict: 'new' | 'similar'
  similar: SongVersionSuggestion[]
}

/**
 * Keeps the songs a check found the library lacks, so Song discovery shows
 * them at once instead of downloading and comparing the source again.
 */
export function saveLackingSongs(sourceId: string, songs: LackingSong[]): void {
  writeSourceCache('lacking', sourceId, songs)
}

/**
 * The songs the library still lacks: those added since the check (by an
 * import in Song discovery, say) are left out.
 */
export function readLackingSongs(sourceId: string): LackingSong[] {
  const songs = readSourceCache<LackingSong>('lacking', sourceId)
  return keepNotInLibrary(
    songs.map((song) => ({ ...song, title: song.parsed.title })),
  )
}
