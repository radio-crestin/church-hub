import { slidesFingerprint } from './slidesFingerprint'
import { createLogger } from '../../../../utils/logger'
import { BUILT_IN_SONG_SOURCES } from '../../../song-sources'
import { readSourceSongList } from '../../../song-sources/updates/readSourceSongList'

const logger = createLogger('backup')

/** A source's published songs are read again after this long. */
const CACHE_MS = 12 * 60 * 60 * 1000

/** Published slides by source file name: the fingerprints a song may match. */
export type PublishedLibrary = Map<string, Set<string>>

let cached: { library: PublishedLibrary; readAt: number } | null = null

/**
 * The built-in sources a backup compares songs against: all of them, or
 * the ids in CHURCH_HUB_BACKUP_PUBLIC_SOURCES (comma-separated; empty =
 * none, so no song is shared and nothing is downloaded, e.g. offline tests).
 */
function publicSources() {
  const listed = process.env.CHURCH_HUB_BACKUP_PUBLIC_SOURCES
  if (listed === undefined) return BUILT_IN_SONG_SOURCES
  const ids = new Set(
    listed
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  )
  return BUILT_IN_SONG_SOURCES.filter((source) => ids.has(source.id))
}

/**
 * The songs Church Hub's built-in, public sources publish (Resurse
 * Creștine and the others shipped with the app: our managed copy, checked
 * against its manifest, or the release file), as fingerprints of their
 * slides by file name. Link subscriptions are never read here: they may be
 * private. A source that can't be read adds nothing, so its songs stay in
 * the encrypted part.
 */
export async function readPublishedLibrary(): Promise<PublishedLibrary> {
  if (cached && Date.now() - cached.readAt < CACHE_MS) return cached.library
  const library: PublishedLibrary = new Map()
  for (const source of publicSources()) {
    try {
      for (const song of await readSourceSongList(source)) {
        if (!song.sourceFilename) continue
        const fingerprint = slidesFingerprint(
          song.parsed.slides.map((slide) => ({
            content: slide.htmlContent,
            label: slide.label,
          })),
        )
        const known = library.get(song.sourceFilename) ?? new Set<string>()
        known.add(fingerprint)
        library.set(song.sourceFilename, known)
      }
    } catch (error) {
      logger.warning(
        `Cloud backup: ${source.id} could not be read; its songs stay encrypted (${error instanceof Error ? error.message : 'unknown'})`,
      )
    }
  }
  cached = { library, readAt: Date.now() }
  return library
}
