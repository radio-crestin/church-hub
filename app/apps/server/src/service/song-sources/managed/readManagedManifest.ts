import { getManagedSourcesUrl } from './getManagedSourcesUrl'
import {
  MANAGED_MANIFEST_FILE,
  MANAGED_MANIFEST_FORMAT,
  MANAGED_MANIFEST_VERSION,
  type ManagedFile,
  type ManagedManifest,
} from './types'
import { createLogger } from '../../../utils/logger'
import { SONG_BUNDLE_EXTENSION } from '../bundle/types'
import { fetchLink } from '../links/fetchLink'
import type { SongSource } from '../types'

const logger = createLogger('song-sources')

/** A file of a managed source's folder in our bucket, by its relative path. */
export const managedFileUrl = (folder: string, path: string) =>
  `${getManagedSourcesUrl()}/${folder}/${path}`

/** The manifest's `.chsongs` archive. */
export const managedArchiveOf = (manifest: ManagedManifest): ManagedFile =>
  manifest.files.find((file) =>
    file.name.endsWith(SONG_BUNDLE_EXTENSION),
  ) as ManagedFile

/** Reads a manifest, refusing anything that is not this source's. */
function parseManagedManifest(text: string, sourceId: string): ManagedManifest {
  const manifest = JSON.parse(text) as ManagedManifest
  if (manifest?.format !== MANAGED_MANIFEST_FORMAT) {
    throw new Error('Not a Church Hub managed song source')
  }
  if (manifest.formatVersion > MANAGED_MANIFEST_VERSION) {
    throw new Error('This song source needs a newer Church Hub')
  }
  if (manifest.sourceId !== sourceId) {
    throw new Error(`The manifest is for ${manifest.sourceId}, not ${sourceId}`)
  }
  if (!Array.isArray(manifest.files) || !managedArchiveOf(manifest)) {
    throw new Error('The managed song source lists no song file')
  }
  return manifest
}

/**
 * A managed source's manifest from our bucket, or null when the source is
 * not managed, no bucket URL is set, or its manifest can't be downloaded
 * (not published yet, the bucket unreachable): the source is then read from
 * its `url`, the GitHub release. A manifest that downloads but is not valid
 * throws.
 */
export async function readManagedManifest(
  source: SongSource,
): Promise<ManagedManifest | null> {
  if (!source.managed || !getManagedSourcesUrl()) return null
  const url = managedFileUrl(source.managed, MANAGED_MANIFEST_FILE)
  let bytes: Uint8Array
  try {
    bytes = await fetchLink(url)
  } catch (error) {
    logger.warning(
      `${source.name}: no managed copy at ${url} (${error instanceof Error ? error.message : error}), reading ${source.url}`,
    )
    return null
  }
  return parseManagedManifest(new TextDecoder().decode(bytes), source.id)
}
