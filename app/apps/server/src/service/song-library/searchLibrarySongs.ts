import { normalizeLyrics } from '@church-hub/song-formats'

import { readCuratedLibrary } from './readCuratedLibrary'

const MAX_RESULTS = 20

/** Library songs whose title holds the query (to merge a submission into). */
export async function searchLibrarySongs(
  query: string,
): Promise<Array<{ id: string; title: string }>> {
  const { manifest } = await readCuratedLibrary()
  const needle = normalizeLyrics([query])
  return (manifest?.songs ?? [])
    .filter((song) => !needle || normalizeLyrics([song.title]).includes(needle))
    .slice(0, MAX_RESULTS)
    .map(({ id, title }) => ({ id, title }))
}
