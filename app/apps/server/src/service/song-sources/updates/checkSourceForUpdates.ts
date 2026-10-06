import type { SourceSong } from '@church-hub/song-formats'

import { applySourcePending } from './applySourcePending'
import { saveChangedSongs } from './changedSongsStore'
import { findChangedSongs } from './findChangedSongs'
import { type LackingSong, saveLackingSongs } from './lackingSongsStore'
import { readSourceSongList } from './readSourceSongList'
import type { SongUpdatesRun, SourceSongChanges, SourceUpdate } from './types'
import {
  backfillAlternateTitles,
  type DiscoveryMatchResult,
  matchCandidatesAgainstLibrary,
} from '../../songs'
import { readSourceChecksum } from '../readSourceChecksum'
import type { SongSource } from '../types'

/** One source's check: what it found, and what it synced. */
export interface SourceCheck {
  update: SourceUpdate
  changes: SourceSongChanges
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

const nothingSynced = (source: SongSource): SourceSongChanges => ({
  sourceId: source.id,
  name: source.name,
  added: { count: 0, songs: [] },
  updated: { count: 0, songs: [] },
})

/**
 * Checks one source for songs the library lacks and songs it changed, and
 * keeps them for the user's approval or, when syncing without approval,
 * syncs them (see applySourcePending).
 * Cheap when nothing changed: a checksum equal to the last check's skips
 * the download, and only syncs what an earlier check left waiting.
 */
export async function checkSourceForUpdates(
  source: SongSource,
  previous: SourceUpdate | undefined,
  run: SongUpdatesRun,
): Promise<SourceCheck> {
  const checksum = await readSourceChecksum(source.id)
  const now = Date.now()
  if (!run.force && previous && checksum && checksum === previous.checksum) {
    const waiting = previous.newCount > 0 || previous.changedCount > 0
    if (!run.autoUpdate || !waiting) {
      return {
        update: { ...previous, name: source.name, checkedAt: now },
        changes: nothingSynced(source),
      }
    }
    const changes = applySourcePending(source)
    return {
      update: {
        ...previous,
        name: source.name,
        newCount: 0,
        changedCount: 0,
        imported: changes.added.count,
        updated: changes.updated.count,
        checkedAt: now,
      },
      changes,
    }
  }

  const songs = await readSourceSongList(source)
  recoverTitles(songs)
  const verdicts = matchSongs(songs)
  const lacking = findLacking(songs, verdicts)
  const changed = findChangedSongs(songs, verdicts)
  saveLackingSongs(source.id, lacking)
  saveChangedSongs(source.id, changed)
  const changes = run.autoUpdate
    ? applySourcePending(source)
    : nothingSynced(source)
  const fresh = lacking.filter((song) => song.verdict === 'new').length
  return {
    update: {
      sourceId: source.id,
      name: source.name,
      checksum,
      newCount: run.autoUpdate ? 0 : fresh,
      similarCount: lacking.length - fresh,
      changedCount: run.autoUpdate ? 0 : changed.length,
      imported: changes.added.count,
      updated: changes.updated.count,
      checkedAt: now,
    },
    changes,
  }
}
