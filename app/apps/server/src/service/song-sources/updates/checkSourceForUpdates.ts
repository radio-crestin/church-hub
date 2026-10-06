import { importSourceSongs } from './importSourceSongs'
import { readSourceSongList } from './readSourceSongList'
import type { SongUpdatesRun, SourceUpdate } from './types'
import { matchCandidatesAgainstLibrary } from '../../songs'
import { readSourceChecksum } from '../readSourceChecksum'
import type { SongSource } from '../types'

/**
 * Checks one source for songs the library lacks and, when updating
 * automatically, adds the ones that are new. Only songs with no similar
 * version in the library are added: a song the library has under another
 * title is left for the user to review in Song discovery.
 * Cheap when nothing changed: a checksum equal to the last check's skips
 * the download.
 */
export async function checkSourceForUpdates(
  source: SongSource,
  previous: SourceUpdate | undefined,
  run: SongUpdatesRun,
): Promise<SourceUpdate> {
  const checksum = await readSourceChecksum(source.id)
  const now = Date.now()
  if (!run.force && previous && checksum && checksum === previous.checksum) {
    return { ...previous, name: source.name, imported: 0, checkedAt: now }
  }

  const songs = await readSourceSongList(source)
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
  const toImport = run.autoUpdate
    ? lacking.filter((song) => verdictById.get(song.id) === 'new')
    : []
  const imported = importSourceSongs(source, toImport)

  return {
    sourceId: source.id,
    name: source.name,
    checksum,
    newCount: lacking.length - imported,
    imported,
    checkedAt: now,
  }
}
