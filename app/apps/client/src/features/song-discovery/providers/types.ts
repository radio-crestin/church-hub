import type { ImportProgress } from '~/features/song-import'
import type { DiscoveryCandidate } from '../types'

/**
 * A source of external songs the discovery flow can pull from. Adding a new
 * source = implement this interface in one file and register it in
 * `providers/index.ts` — no other wiring required.
 *
 * NB: providers that download from the web must use a domain already present
 * in the server's `/api/proxy/download` allowlist (apps/server/src/index.ts).
 */
export interface SourceProvider {
  /** Stable id, used as the React Query cache key and provider selector. */
  id: string
  /** i18n key (songDiscovery namespace) for the human-readable source name. */
  labelKey: string
  /**
   * URL of the catalog archive. Used by the background sync's cheap HEAD
   * change-check (skip re-download when unchanged). Its domain must be in the
   * server's `/api/proxy/download` + `/api/proxy/head` allowlist.
   */
  catalogUrl: string
  /** Downloads + parses the source catalog into comparable candidates. */
  fetchCatalog(
    onProgress?: (progress: ImportProgress) => void,
  ): Promise<DiscoveryCandidate[]>
  /**
   * Default category name new songs from this source land in (created on
   * import if missing). Mirrors the legacy one-shot Resurse Crestine flow.
   */
  defaultCategoryName: string
}
