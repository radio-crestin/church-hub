/** One source Church Hub offers every app: a library it manages. */
export interface FeaturedSource {
  /** Its folder next to featured.json: `<sourceId>/manifest.json`. */
  sourceId: string
  name: string
  categoryName: string
  description: string | null
  homepage: string | null
  license: string | null
}

/** `libraries/featured.json` (churchhub-backend writeFeatured). */
export interface FeaturedSources {
  format: 'church-hub-featured-sources'
  version: 1
  updatedAt: string
  sources: FeaturedSource[]
}

/** The list and where it was read from (its libraries sit next to it). */
export interface FeaturedList {
  featured: FeaturedSources
  url: string
}
