import {
  LIBRARY_BUNDLE_VERSION,
  type LibraryManifest,
  readLibraryShard,
} from '@church-hub/song-formats'

import { fetchLink } from './fetchLink'
import { sourceFileUrl } from './sourceFileUrl'
import type {
  SongBundleManifest,
  SongBundleManifestEntry,
} from '../bundle/types'

/** Downloads at a time; a first read of a large folder stays quick. */
const CONCURRENCY = 16

async function runLimited<T>(items: T[], task: (item: T) => Promise<void>) {
  const queue = [...items]
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
        await task(item)
      }
    }),
  )
}

/**
 * Downloads the files holding the stale songs and hands each song's
 * contents to `save`: one OpenSong file per song in a song bundle, or, in
 * a shared library (version 3), only the shards that hold them, each
 * checked against its hash.
 */
export async function downloadStaleSongs(
  manifestUrl: string,
  manifest: SongBundleManifest,
  stale: SongBundleManifestEntry[],
  save: (entry: SongBundleManifestEntry, contents: string) => void,
): Promise<void> {
  if (manifest.version < LIBRARY_BUNDLE_VERSION) {
    await runLimited(stale, async (entry) => {
      const bytes = await fetchLink(sourceFileUrl(manifestUrl, entry.path))
      save(entry, new TextDecoder().decode(bytes))
    })
    return
  }
  const shards = new Map(
    (manifest as unknown as LibraryManifest).shards.map((s) => [s.path, s]),
  )
  const wanted = new Map(stale.map((entry) => [entry.id, entry]))
  const paths = [...new Set(stale.map((entry) => entry.path))]
  await runLimited(paths, async (path) => {
    const shard = shards.get(path)
    if (!shard) throw new Error(`The manifest lists no shard ${path}`)
    const bytes = await fetchLink(sourceFileUrl(manifestUrl, path))
    for (const song of (await readLibraryShard(bytes, shard)).songs) {
      const entry = wanted.get(song.id)
      if (entry) save(entry, song.xml)
    }
  })
}
