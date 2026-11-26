import type { SongBundleFile } from '@church-hub/song-formats'

export type { SongBundleFile }

/** Mirrors the server's `SongSourceFormat`. */
export type SongSourceFormat =
  | 'cantaricrestine-api'
  | 'song-bundle-file'
  | 'song-bundle-folder'

/**
 * Where a source came from: shipped with the app, added from a shared link,
 * or a `.chsongs` file the user just opened (kept in memory only).
 */
export type SongSourceOrigin = 'built-in' | 'link' | 'file'

/** Mirrors the server's `SongSource` (GET /api/song-sources). */
export interface SongSource {
  id: string
  /** Display name, a proper noun shown as-is in every language. */
  name: string
  /** Category new songs from this source land in (created if missing). */
  categoryName: string
  format: SongSourceFormat
  url: string
  homepage?: string
  license?: string
  origin: SongSourceOrigin
}
