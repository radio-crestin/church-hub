import type { ImportProgress } from '~/features/song-import'
import type { DiscoveryCandidate } from '../types'

/** Mirrors the server's `SongSourceFormat`. */
export type SongSourceFormat =
  | 'opensong-zip'
  | 'cantaricrestine-api'
  | 'church-hub-bundle'

/** Mirrors the server's `SongSource` (GET /api/song-sources). */
export interface SongSource {
  id: string
  /** Display name, a proper noun shown as-is in every language. */
  name: string
  /** Category new songs from this source land in (created if missing). */
  categoryName: string
  format: SongSourceFormat
  /** Catalog URL; downloaded through the server proxy, which allows only
   * the hosts of known sources. */
  url: string
  homepage?: string
  license?: string
  origin: 'built-in'
}

/** Downloads and parses one source's catalog into comparable candidates. */
export type FetchCatalog = (
  source: SongSource,
  onProgress?: (progress: ImportProgress) => void,
) => Promise<DiscoveryCandidate[]>
