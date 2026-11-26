/**
 * A shared song library: a song source published to the sync bucket under
 * `libraries/<sourceId>/` (docs/design/cloud-sync-and-shared-library.md §9).
 *
 *   libraries/<sourceId>/manifest.json            this manifest; short cache
 *   libraries/<sourceId>/shards/<hash>.json.gz    ~500 songs each; cached forever
 *
 * The manifest is a song bundle manifest (the T-120 format, bundle version 3):
 * each song's `path` is the shard that holds it, so a reader downloads only
 * the shards whose path it does not have yet. A shard is named by the
 * SHA-256 of its uncompressed JSON, so equal content means an equal name and
 * a changed song changes only its own shard.
 */
export const LIBRARY_BUNDLE_FORMAT = 'church-hub-song-bundle'

/** The bundle version that introduced shards; v2 readers refuse it. */
export const LIBRARY_BUNDLE_VERSION = 3

export const LIBRARY_SHARD_FORMAT = 'church-hub-song-shard'
export const LIBRARY_SHARD_VERSION = 1

/** Songs per shard on average: shards hold 250 to 500 songs, or fewer in a small library. */
export const LIBRARY_SHARD_SIZE = 500

export const LIBRARY_MANIFEST_FILE = 'manifest.json'
export const LIBRARY_SHARDS_DIR = 'shards'
export const LIBRARY_SHARD_EXTENSION = '.json.gz'

/** Cache-Control of each object: the manifest is re-read, shards never change. */
export const LIBRARY_MANIFEST_CACHE_CONTROL = 'public, max-age=60'
export const LIBRARY_SHARD_CACHE_CONTROL = 'public, max-age=31536000, immutable'

/** One song in a shard. */
export interface LibraryShardSong {
  /** The song's id in its source (its uuid), stable across re-publishes. */
  id: string
  title: string
  /** SHA-256 hex of `xml`: changes whenever anything in the song does. */
  hash: string
  /** SHA-256 hex of the song's normalized lyrics (lyricsFingerprint). */
  fingerprint: string
  /** The song as an OpenSong file. */
  xml: string
}

/** A shard's JSON, before gzip; its songs sorted by id. */
export interface LibraryShard {
  format: typeof LIBRARY_SHARD_FORMAT
  version: number
  songs: LibraryShardSong[]
}

/** One song's line in the manifest. */
export interface LibraryManifestSong {
  id: string
  title: string
  /** The shard holding the song: `shards/<shard hash>.json.gz`. */
  path: string
  hash: string
  fingerprint: string
}

export interface LibraryManifestShard {
  /** `shards/<hash>.json.gz`, relative to the manifest. */
  path: string
  /** SHA-256 hex of the uncompressed shard JSON; a reader refuses a shard that differs. */
  hash: string
  /** Bytes of the gzipped object. */
  size: number
  songCount: number
}

export interface LibraryManifest {
  format: typeof LIBRARY_BUNDLE_FORMAT
  version: number
  /** The folder under `libraries/`: a random id, also the client's source id. */
  sourceId: string
  name: string
  categoryName: string
  /** Shown in the public catalog when true; unlisted (link only) by default. */
  listed: boolean
  /** Who publishes it: a church's name, or "Church Hub" for the curated one. */
  publisher: string
  /** SHA-256 hex over the name, category and every song's hash: changes exactly when they do. */
  checksum: string
  /** ISO time the library was built. */
  updatedAt: string
  songCount: number
  shards: LibraryManifestShard[]
  songs: LibraryManifestSong[]
}

/** A song going into a library. */
export interface LibrarySongInput {
  id: string
  title: string
  xml: string
  /** Lyrics blocks (verses, slides) as plain text or slide HTML, in order. */
  lyrics: string[]
}

/** A built library: its manifest and each shard's gzipped bytes by path. */
export interface LibraryFiles {
  manifest: LibraryManifest
  shards: Map<string, Uint8Array>
}
