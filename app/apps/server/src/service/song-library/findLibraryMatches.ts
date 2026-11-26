import {
  type LibraryManifest,
  lyricsFingerprint,
  normalizeLyrics,
} from '@church-hub/song-formats'

import type { LibraryMatch } from './types'

const MAX_MATCHES = 5

/**
 * Library songs the submission may duplicate: the same lyrics (their
 * fingerprint), then the same title, diacritics and punctuation aside.
 */
export async function findLibraryMatches(
  manifest: LibraryManifest | null,
  title: string,
  lyrics: string[],
): Promise<LibraryMatch[]> {
  if (!manifest) return []
  const fingerprint = await lyricsFingerprint(lyrics)
  const normalizedTitle = normalizeLyrics([title])
  const sameLyrics = manifest.songs.filter(
    (song) => fingerprint && song.fingerprint === fingerprint,
  )
  const sameTitle = manifest.songs.filter(
    (song) =>
      !sameLyrics.includes(song) &&
      normalizeLyrics([song.title]) === normalizedTitle,
  )
  return [
    ...sameLyrics.map((song) => ({ ...song, sameLyrics: true })),
    ...sameTitle.map((song) => ({ ...song, sameLyrics: false })),
  ]
    .slice(0, MAX_MATCHES)
    .map(({ id, title: songTitle, sameLyrics: same }) => ({
      id,
      title: songTitle,
      sameLyrics: same,
    }))
}
