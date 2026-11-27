import {
  type LibraryManifest,
  type LibraryManifestShard,
  type LibraryShard,
  readLibraryShard,
} from '@church-hub/song-formats'

import { libraryRequest } from './libraryRequest'

/** Downloads give up after this long. */
const TIMEOUT_MS = 60_000

export interface CuratedLibrary {
  /** Null before the first song is published. */
  manifest: LibraryManifest | null
  readShard: (entry: LibraryManifestShard) => Promise<LibraryShard>
}

async function download(url: string): Promise<Response> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!response.ok && response.status !== 404 && response.status !== 403) {
    throw new Error(`Library download failed: ${response.status}`)
  }
  return response
}

/**
 * The curated library as published, read from the bucket like any reader
 * does. The manifest's URL gets a query of its own each time, so a cache
 * in front of the bucket never answers with an older one.
 */
export async function readCuratedLibrary(): Promise<CuratedLibrary> {
  const { manifestUrl } = await libraryRequest<{ manifestUrl: string }>(
    'GET',
    '',
  )
  const response = await download(`${manifestUrl}?at=${Date.now()}`)
  // A missing object: 404, or 403 from a bucket that hides what it lacks.
  const manifest = response.ok
    ? ((await response.json()) as LibraryManifest)
    : null
  const base = manifestUrl.slice(0, manifestUrl.lastIndexOf('/') + 1)
  return {
    manifest,
    async readShard(entry) {
      const shard = await download(`${base}${entry.path}`)
      if (!shard.ok) throw new Error(`Library shard ${entry.path} is missing`)
      return readLibraryShard(new Uint8Array(await shard.arrayBuffer()), entry)
    },
  }
}
