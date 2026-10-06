import type { SourceSong } from '@church-hub/song-formats'

import { importSourceSongs } from './importSourceSongs'
import { readSourceSongList } from './readSourceSongList'
import type { SongUpdatesRun, SourceUpdate } from './types'
import {
  backfillAlternateTitles,
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

/** The songs the library lacks, and the new ones among them (no similar version). */
function findLacking(songs: SourceSong[]) {
  const verdicts = matchCandidatesAgainstLibrary(
    songs.map((song) => ({
      tempId: song.id,
      title: song.parsed.title,
      lyrics: song.parsed.slides.map((slide) => slide.htmlContent).join(' '),
      sourceFilename: song.sourceFilename,
    })),
  )
  const verdictById = new Map(verdicts.map((v) => [v.tempId, v.verdict]))
  const lacking = songs.filter((song) => {
    const verdict = verdictById.get(song.id)
    return verdict === 'new' || verdict === 'similar'
  })
  const fresh = lacking.filter((song) => verdictById.get(song.id) === 'new')
  return { lacking, fresh }
}

/**
 * Checks one source for songs the library lacks and, when updating
 * automatically, adds the new ones. A song the library has under another
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
  const { lacking, fresh } = findLacking(songs)
  const added = importSourceSongs(source, run.autoUpdate ? fresh : [])
  return {
    update: {
      sourceId: source.id,
      name: source.name,
      checksum,
      newCount: lacking.length - added,
      imported: added,
      checkedAt: now,
    },
    added,
  }
}
