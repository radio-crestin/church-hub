/** Where shared libraries and the curated library's submissions live. */
export const libraryKeys = {
  /** Public: the listed libraries (updateCatalog). */
  catalog: 'libraries/catalog.json',
  /** Public: the sources Church Hub offers every app (writeFeatured). */
  featured: 'libraries/featured.json',
  /** Public, unlisted: `libraries/<sourceId>/`. */
  prefix: (sourceId: string) => `libraries/${sourceId}/`,
  manifest: (sourceId: string) => `libraries/${sourceId}/manifest.json`,
  /** Public, immutable; `path` is the manifest's `shards/<hash>.json.gz`. */
  shardsPrefix: (sourceId: string) => `libraries/${sourceId}/shards/`,
  shard: (sourceId: string, hash: string) =>
    `libraries/${sourceId}/shards/${hash}.json.gz`,
  /** Private (the state bucket): waiting for a curator. */
  pendingPrefix: 'submissions/pending/',
  pending: (id: string) => `submissions/pending/${id}.json`,
  /** Private: decided, for the record. */
  decided: (id: string) => `submissions/decided/${id}.json`,
}
