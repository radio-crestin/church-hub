/**
 * How a source's catalog is laid out at its `url`:
 * - `opensong-zip`: a ZIP of OpenSong XML files (Resurse Creștine).
 * - `cantaricrestine-api`: cantaricrestine.ro's JSON API (plain-text lyrics).
 * - `church-hub-bundle`: a Church Hub song bundle (gzipped JSON).
 */
export type SongSourceFormat =
  | 'opensong-zip'
  | 'cantaricrestine-api'
  | 'church-hub-bundle'

/** One song source, as written in a config file under `built-in/`. */
export interface SongSourceConfig {
  /** Stable id: the config's file name and the client's cache key. */
  id: string
  /** Display name (a proper noun, shown as-is in every language). */
  name: string
  /** Category the source's songs land in, created on import if missing. */
  categoryName: string
  format: SongSourceFormat
  /** Where the catalog is downloaded from (through the server proxy). */
  url: string
  homepage?: string
  license?: string
}

/** Where a source came from: shipped with the app, or added by the user. */
export type SongSourceOrigin = 'built-in'

export interface SongSource extends SongSourceConfig {
  origin: SongSourceOrigin
}
