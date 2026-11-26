import { SyncError } from '../sync/SyncError'
import type { LibraryManifest } from './types'

const SHARD_PATH = /^shards\/([0-9a-f]{64})\.json\.gz$/

function invalid(message: string): never {
  throw new SyncError(400, 'invalid_manifest', message)
}

/**
 * A manifest a PC sent for `sourceId`: bundle version 3, its own source,
 * each shard named by its hash, each song in a listed shard; 400 otherwise.
 */
export function checkManifest(
  value: unknown,
  sourceId: string
): LibraryManifest {
  const manifest = value as LibraryManifest
  if (
    manifest?.format !== 'church-hub-song-bundle' ||
    manifest.version !== 3 ||
    manifest.sourceId !== sourceId ||
    typeof manifest.checksum !== 'string' ||
    !Array.isArray(manifest.songs) ||
    !Array.isArray(manifest.shards)
  ) {
    invalid(`Not a version 3 manifest of ${sourceId}`)
  }
  const paths = new Set<string>()
  for (const shard of manifest.shards) {
    if (shard?.path?.match(SHARD_PATH)?.[1] !== shard.hash) {
      invalid('A shard path does not match its hash')
    }
    paths.add(shard.path)
  }
  if (!manifest.songs.every((song) => paths.has(song?.path))) {
    invalid('Every song must be in a listed shard')
  }
  return manifest
}
