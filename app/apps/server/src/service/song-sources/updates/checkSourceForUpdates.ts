import type { SourceSong } from '@church-hub/song-formats'

import { findChangedSongs } from './findChangedSongs'
import { importSourceSongs } from './importSourceSongs'
import { type LackingSong, saveLackingSongs } from './lackingSongsStore'
import { readSourceSongList } from './readSourceSongList'
import type { SongUpdatesRun, SourceUpdate } from './types'
import { updateLibrarySongs } from './updateLibrarySongs'
import {
  backfillAlternateTitles,
  type DiscoveryMatchResult,
  matchCandidatesAgainstLibrary,
} from '../../songs'
import { readSourceChecksum } from '../readSourceChecksum'
import type { SongSource } from '../types'

/** One source's check: what it found, and the songs this check added. */
export interface SourceCheck {
  update: SourceUpdate
  added: number
}

/**
 * Library songs filed under their first line get back the name the source
 * knows them by, matched on the file they came from.
 */
function recoverTitles(songs: SourceSong[]): void {
  backfillAlternateTitles(
    songs.flatMap(({ sourceFilename, parsed }) =>
      sourceFilename && parsed.title
        ? [{ sourceFilename, titles: [parsed.title] }]
        : [],
    ),
  )
}

/** Each song's verdict against the library. */
function matchSongs(songs: SourceSong[]): DiscoveryMatchResult[] {
  return matchCandidatesAgainstLibrary(
    songs.map((song) => ({
      tempId: song.id,
      title: song.parsed.title,
      lyrics: song.parsed.slides.map((slide) => slide.htmlContent).join(' '),
      sourceFilename: song.sourceFilename,
    })),
  )
}

/** The songs the library lacks, each with its verdict and similar versions. */
function findLacking(
  songs: SourceSong[],
  verdicts: DiscoveryMatchResult[],
): LackingSong[] {
  const byId = new Map(verdicts.map((v) => [v.tempId, v]))
  return songs.flatMap((song) => {
    const match = byId.get(song.id)
    if (match?.verdict !== 'new' && match?.verdict !== 'similar') return []
    return [{ ...song, verdict: match.verdict, similar: match.similar }]
  })
}

/**
 * Checks one source for songs the library lacks and, when updating
 * automatically, adds the new ones and brings the songs nobody edited by
 * hand up to date with the source. A song the library has under another
 * title is left for the user to review in Song discovery.
 * Cheap when nothing changed: a checksum equal to the last check's skips
 * the download.
 */
export async function checkSourceForUpdates(
  source: SongSource,
  previous: SourceUpdate | undefined,
  run: SongUpdatesRun,
): Promise<SourceCheck> {
  const checksum = await readSourceChecksum(source.id)
  const now = Date.now()
  if (!run.force && previous && checksum && checksum === previous.checksum) {
    return {
      update: { ...previous, name: source.name, checkedAt: now },
      added: 0,
    }
  }

  const songs = await readSourceSongList(source)
  recoverTitles(songs)
  const verdicts = matchSongs(songs)
  const lacking = findLacking(songs, verdicts)
  const toAdd = run.autoUpdate
    ? lacking.filter((song) => song.verdict === 'new')
    : []
  const added = importSourceSongs(source, toAdd)
  const updated = run.autoUpdate
    ? updateLibrarySongs(findChangedSongs(songs, verdicts))
    : 0
  const left = lacking.filter((song) => !toAdd.includes(song))
  saveLackingSongs(source.id, left)
  return {
    update: {
      sourceId: source.id,
      name: source.name,
      checksum,
      newCount: left.length,
      imported: added,
      updated,
      checkedAt: now,
    },
    added: added + updated,
  }
}
