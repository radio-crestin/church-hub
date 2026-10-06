import type { SourceSong } from '@church-hub/song-formats'

import type { DiscoveryCandidate } from '../types'

/** A source's songs as discovery candidates, each with an id unique across sources. */
export function sourceSongsToCandidates(
  sourceId: string,
  songs: SourceSong[],
): DiscoveryCandidate[] {
  return songs.map((song) => ({
    tempId: `${sourceId}-${song.id}`,
    parsed: song.parsed,
    sourceFilename: song.sourceFilename,
  }))
}
