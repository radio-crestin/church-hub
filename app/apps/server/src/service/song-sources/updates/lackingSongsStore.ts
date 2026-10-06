import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SourceSong } from '@church-hub/song-formats'

import { getDataDir } from '../../../utils/paths'
import { keepNotInLibrary, type SongVersionSuggestion } from '../../songs'

/** A song of a source the library lacks, as the last check classified it. */
export interface LackingSong extends SourceSong {
  /** 'similar': the library has a version of it under another title. */
  verdict: 'new' | 'similar'
  similar: SongVersionSuggestion[]
}

const folder = () => join(getDataDir(), 'song-sources', 'lacking')
const fileOf = (sourceId: string) =>
  join(folder(), `${encodeURIComponent(sourceId)}.json`)

/**
 * Keeps the songs a check found the library lacks, so Song discovery shows
 * them at once instead of downloading and comparing the source again.
 */
export function saveLackingSongs(sourceId: string, songs: LackingSong[]): void {
  mkdirSync(folder(), { recursive: true })
  writeFileSync(fileOf(sourceId), JSON.stringify(songs))
}

/**
 * The songs the library still lacks: those added since the check (by an
 * import in Song discovery, say) are left out.
 */
export function readLackingSongs(sourceId: string): LackingSong[] {
  const file = fileOf(sourceId)
  if (!existsSync(file)) return []
  const songs = JSON.parse(readFileSync(file, 'utf8')) as LackingSong[]
  return keepNotInLibrary(
    songs.map((song) => ({ ...song, title: song.parsed.title })),
  )
}
