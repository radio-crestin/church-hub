import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { getBundledLibrariesDir } from './getBundledLibrariesDir'

/** A library's manifest or shard, by the end of its URL. */
const LIBRARY_FILE =
  /\/libraries\/([A-Za-z0-9_-]{1,128})\/(manifest\.json|shards\/[0-9a-f]{64}\.json\.gz)(?:\?.*)?$/

/**
 * The installer's copy of a featured library's file (the same layout as in
 * the bucket), for reading it with no internet; null when not shipped.
 */
export function readBundledLibraryFile(url: string): Uint8Array | null {
  const match = url.match(LIBRARY_FILE)
  const dir = getBundledLibrariesDir()
  if (!match || !dir) return null
  const path = join(dir, match[1] as string, match[2] as string)
  return existsSync(path) ? new Uint8Array(readFileSync(path)) : null
}
