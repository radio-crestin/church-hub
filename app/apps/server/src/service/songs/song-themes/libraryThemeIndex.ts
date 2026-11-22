import { PLAIN_WORDS, THEMES_OF_STEM, type ThemeId } from './themeLexicon'
import { themeStem } from './themeStem'
import {
  getLibraryVersionIndex,
  type LibraryVersionIndex,
  libraryIndexGeneration,
} from '../song-versions/libraryVersionIndex'

/**
 * A stem in more songs than this share of the library says nothing about a
 * theme ("doamne", "inima"): it is left out of every comparison.
 */
const MAX_STEM_SHARE = 0.04
/** ...unless the library is so small that the share is a handful of songs. */
const MIN_STEM_CAP = 40
/** A word naming a theme (see `themeLexicon`) weighs this many times more. */
const THEME_WORD_BOOST = 2

/**
 * The library's songs as weighted stems, derived from the version index:
 * a stem weighs more the fewer songs hold it (its idf), so two songs
 * sharing "golgota" and "jertfa" are closer than two sharing "cer".
 */
export interface LibraryThemeIndex {
  stemIds: Map<string, number>
  /** Place in the version index → the song's stems that carry weight. */
  songStems: Array<Int32Array | null>
  /** Stem id → places of the songs that hold it. */
  stemPostings: number[][]
  /** Stem id → its weight (0: too common or too rare to tell a theme). */
  weight: Float64Array
  /** Place → length of the song's weighted stem vector. */
  norm: Float64Array
  /** Place → the named themes the song is on. */
  songThemes: Array<ThemeId[] | null>
}

let cached: { index: LibraryThemeIndex; generation: number } | null = null

/** The theme index for the library as it is now, rebuilt after any change. */
export function getLibraryThemeIndex(): LibraryThemeIndex {
  const versions = getLibraryVersionIndex()
  const generation = libraryIndexGeneration()
  if (cached?.generation !== generation) {
    cached = { index: buildThemeIndex(versions), generation }
  }
  return cached.index
}

function buildThemeIndex(versions: LibraryVersionIndex): LibraryThemeIndex {
  const stemIds = new Map<string, number>()
  const stemNames: string[] = []
  const stemOfWord = new Int32Array(versions.wordIds.size)
  for (const [word, id] of versions.wordIds) {
    const stem = themeStem(word)
    let stemId = stemIds.get(stem)
    if (stemId === undefined) {
      stemId = stemIds.size
      stemIds.set(stem, stemId)
      stemNames.push(stem)
    }
    stemOfWord[id] = stemId
  }

  const stemPostings: number[][] = Array.from(
    { length: stemIds.size },
    () => [],
  )
  const allStems = versions.songs.map((song, place) => {
    if (!song) return null
    const stems = new Set<number>()
    for (const id of song.title.ids) stems.add(stemOfWord[id])
    for (const id of song.lyrics.ids) stems.add(stemOfWord[id])
    for (const stem of stems) stemPostings[stem].push(place)
    return stems
  })

  const songCount = versions.placeOf.size
  const cap = Math.max(MIN_STEM_CAP, MAX_STEM_SHARE * songCount)
  const weight = new Float64Array(stemIds.size)
  stemPostings.forEach((places, stem) => {
    const name = stemNames[stem]
    if (places.length < 2 || PLAIN_WORDS.has(name)) return
    const idf = Math.log(songCount / places.length)
    if (THEMES_OF_STEM.has(name)) weight[stem] = THEME_WORD_BOOST * idf
    else if (places.length <= cap) weight[stem] = idf
  })

  const norm = new Float64Array(versions.songs.length)
  const songStems = allStems.map((stems, place) => {
    if (!stems) return null
    const kept = [...stems].filter((stem) => weight[stem] > 0)
    norm[place] = Math.sqrt(kept.reduce((sum, s) => sum + weight[s] ** 2, 0))
    return Int32Array.from(kept)
  })
  const songThemes = versions.songs.map((song, place) => {
    const stems = allStems[place]
    if (!song || !stems) return null
    const titleStems = new Set([...song.title.ids].map((id) => stemOfWord[id]))
    return themesOf(
      [...stems].map((stem) => stemNames[stem]),
      (stem) => titleStems.has(stemIds.get(stem) ?? -1),
    )
  })
  return { stemIds, songStems, stemPostings, weight, norm, songThemes }
}

/**
 * The themes a song is on: two of a theme's words in it, or one in its
 * title ("Cina Domnului").
 */
function themesOf(
  stems: string[],
  inTitle: (stem: string) => boolean,
): ThemeId[] {
  const hits = new Map<ThemeId, number>()
  for (const stem of stems) {
    for (const theme of THEMES_OF_STEM.get(stem) ?? []) {
      hits.set(theme, (hits.get(theme) ?? 0) + (inTitle(stem) ? 2 : 1))
    }
  }
  return [...hits].filter(([, count]) => count >= 2).map(([theme]) => theme)
}
