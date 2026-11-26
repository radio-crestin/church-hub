import { readManagedManifest } from './readManagedManifest'
import type { ManagedRelease } from './types'
import { findSongSource } from '../listSongSources'

/**
 * The version of a managed source's copy in our bucket, or null while there
 * is none (the source is then read from the GitHub release).
 */
export async function readManagedRelease(
  sourceId: string,
): Promise<ManagedRelease | null> {
  const manifest = await readManagedManifest(findSongSource(sourceId))
  if (!manifest) return null
  const { version, checksum, songCount, builtAt } = manifest
  return { version, checksum, songCount, builtAt }
}
