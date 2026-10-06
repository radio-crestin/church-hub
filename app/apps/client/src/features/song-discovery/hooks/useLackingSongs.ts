import { bundleFilesToSongs } from '@church-hub/song-formats'
import { useQueries } from '@tanstack/react-query'

import { getOpenedSongFile } from '../opened-files/openedSongFiles'
import type { SongSource } from '../providers'
import { sourceSongsToCandidates } from '../providers/sourceSongsToCandidates'
import { matchCandidates } from '../service/discoveryApi'
import { getLackingSongs } from '../service/songSourcesApi'
import type { LackingEntry } from '../types'

export const LACKING_SONGS_QUERY_KEY = 'song-source-lacking'

/** A source's songs the library lacks, from the server's last check. */
async function serverLacking(source: SongSource): Promise<LackingEntry[]> {
  const songs = await getLackingSongs(source.id)
  return songs.map((song) => ({
    sourceId: source.id,
    candidate: {
      tempId: `${source.id}-${song.id}`,
      parsed: song.parsed,
      sourceFilename: song.sourceFilename,
    },
    verdict: song.verdict,
    similar: song.similar,
  }))
}

/** An opened song file's songs the library lacks, compared here. */
async function openedFileLacking(source: SongSource): Promise<LackingEntry[]> {
  const { files, ownFormat } = getOpenedSongFile(source.id)
  const candidates = sourceSongsToCandidates(
    source.id,
    bundleFilesToSongs(files, { exactTitle: ownFormat }),
  )
  const byTempId = new Map(candidates.map((c) => [c.tempId, c]))
  const results = await matchCandidates(candidates)
  return results.flatMap((result) => {
    const candidate = byTempId.get(result.tempId)
    if (!candidate) return []
    if (result.verdict !== 'new' && result.verdict !== 'similar') return []
    return [
      {
        sourceId: source.id,
        candidate,
        verdict: result.verdict,
        similar: result.similar,
      },
    ]
  })
}

/**
 * The songs the given sources have and the library lacks. A source's list is
 * read again when the server finishes a new check (`checkedAt`).
 */
export function useLackingSongs(
  sources: SongSource[],
  checkedAt: number | null,
) {
  const { entries, statuses } = useQueries({
    queries: sources.map((source) => ({
      queryKey: [
        LACKING_SONGS_QUERY_KEY,
        source.id,
        source.origin === 'file' ? 0 : checkedAt,
      ],
      queryFn: () =>
        source.origin === 'file'
          ? openedFileLacking(source)
          : serverLacking(source),
      staleTime: Number.POSITIVE_INFINITY,
    })),
    // Combined once per change, so the list is not rebuilt on every render.
    combine: (results) => ({
      entries: results.flatMap((result) => result.data ?? []),
      statuses: results.map((result) => result.status),
    }),
  })
  return {
    entries,
    isLoading: statuses.includes('pending'),
    loaded: sources.filter((_, index) => statuses[index] === 'success'),
    failed: sources.filter((_, index) => statuses[index] === 'error'),
  }
}
