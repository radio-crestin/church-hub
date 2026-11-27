/**
 * Shared song libraries (design §9) and the curated Church Hub Library
 * (T-177): songs users submit, reviewed by curators, published like any
 * shared library under `libraries/<CURATED_SOURCE_ID>/`.
 */

/** Its folder under libraries/ and its id as a song source. */
export const CURATED_SOURCE_ID = 'church-hub'
export const CURATED_SOURCE_NAME = 'Church Hub'

/** A song the way a church sent it: the OpenSong file of a song bundle. */
export interface SubmittedSong {
  title: string
  /** The song as OpenSong XML (the T-120 song bundle's song file). */
  xml: string
}

/** One song a church sent in, waiting for a curator (private). */
export interface Submission extends SubmittedSong {
  id: string
  /** Unix ms. */
  submittedAt: number
  /** The song's uuid in the church that sent it. */
  sourceSongId: string | null
  churchName: string | null
  note: string | null
  /** The songs sent together (a category, a selection) share it. */
  batchId: string
  batchSize: number
}

export type Decision = 'approved' | 'merged' | 'rejected'

/** A submission once a curator decided it (kept for the record). */
export interface DecidedSubmission extends Submission {
  decision: Decision
  decidedAt: number
  /** The curator's email. */
  decidedBy: string
  /** The library song it became or updated; null when rejected. */
  librarySongId: string | null
  reason: string | null
}

/**
 * What the service checks of a manifest a PC built (the format is
 * app/packages/song-formats/src/library/types.ts, bundle version 3).
 */
export interface LibraryManifest {
  format: 'church-hub-song-bundle'
  version: number
  sourceId: string
  name?: string
  publisher?: string
  /** In the public catalog when true; unlisted (link only) otherwise. */
  listed?: boolean
  updatedAt?: string
  songCount?: number
  checksum: string
  songs: Array<{ id: string; path: string }>
  shards: Array<{ path: string; hash: string }>
}

/** One listed library in the public catalog. */
export interface CatalogEntry {
  sourceId: string
  name: string
  publisher: string
  songCount: number
  updatedAt: string
}

/** `libraries/catalog.json`: the libraries their publishers listed. */
export interface Catalog {
  format: 'church-hub-library-catalog'
  version: 1
  libraries: CatalogEntry[]
}

/** One source Church Hub offers every app: a library it manages. */
export interface FeaturedSource {
  /** Its folder under libraries/: `<sourceId>/manifest.json`. */
  sourceId: string
  name: string
  /** The category its songs land in. */
  categoryName: string
  description: string | null
  homepage: string | null
  license: string | null
}

/** `libraries/featured.json`: the sources every app lists, in order. */
export interface FeaturedSources {
  format: 'church-hub-featured-sources'
  version: 1
  updatedAt: string
  sources: FeaturedSource[]
}
