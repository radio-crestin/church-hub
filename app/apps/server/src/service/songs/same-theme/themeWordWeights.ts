import { forEachSongWord } from './forEachSongWord'
import type { LibraryVersionIndex } from '../song-versions/libraryVersionIndex'

/**
 * A word in more than this share of the library ("Doamne", "inima") says
 * nothing about a song's theme: it does not bring songs in by itself.
 */
export const COMMON_WORD_SHARE = 0.05

export interface ThemeWordWeights {
  /** Word id → squared inverse document frequency; 0 for a word no other song has. */
  weight: Float64Array
  /** Word id → how many songs hold it. */
  songCount: Int32Array
  songTotal: number
}

/**
 * How much each word tells about a song's theme: the rarer across the
 * library, the more (inverse document frequency, squared for a cosine).
 * Counted afresh on each call: a pass over the index takes a few ms and is
 * never out of step with it.
 */
export function themeWordWeights(index: LibraryVersionIndex): ThemeWordWeights {
  const songCount = new Int32Array(index.wordIds.size)
  let songTotal = 0
  for (const song of index.songs) {
    if (!song) continue
    songTotal++
    forEachSongWord(song, (id) => songCount[id]++)
  }
  const weight = new Float64Array(songCount.length)
  for (let id = 0; id < songCount.length; id++) {
    if (songCount[id] >= 2)
      weight[id] = Math.log(songTotal / songCount[id]) ** 2
  }
  return { weight, songCount, songTotal }
}
