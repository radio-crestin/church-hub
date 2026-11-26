/**
 * How a source's catalog is laid out at its `url`:
 * - `cantaricrestine-api`: cantaricrestine.ro's JSON API (plain-text lyrics).
 * - `song-bundle-file`: a `.chsongs` song bundle file (see bundle/types.ts).
 * - `song-bundle-folder`: a song bundle folder, by its manifest.json URL.
 */
export type SongSourceFormat =
  | 'cantaricrestine-api'
  | 'song-bundle-file'
  | 'song-bundle-folder'

/** One song source, as written in a config file under `built-in/`. */
export interface SongSourceConfig {
  /** Stable id: the config's file name and the client's cache key. */
  id: string
  /** Display name (a proper noun, shown as-is in every language). */
  name: string
  /** Category the source's songs land in, created on import if missing. */
  categoryName: string
  format: SongSourceFormat
  /** Where the catalog is downloaded from (through the server). */
  url: string
  homepage?: string
  license?: string
}

/**
 * Where a source came from: shipped with the app, or added by the user from
 * someone's shared link.
 */
export type SongSourceOrigin = 'built-in' | 'link'

export interface SongSource extends SongSourceConfig {
  origin: SongSourceOrigin
}
