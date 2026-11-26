/**
 * A source Church Hub manages itself: computed by a GitHub Action and
 * published to our S3 bucket (docs/managed-song-sources.md), laid out as
 *
 *   <folder>/latest.json                 this manifest, cached briefly
 *   <folder>/<version>/<file>            each version's files, never changed
 *
 * where <folder> is the source's `managed` path under the bucket's public
 * URL (getManagedSourcesUrl). Written by scripts/publish-managed-source.ts,
 * read by readManagedManifest.
 */
export const MANAGED_MANIFEST_FORMAT = 'church-hub-managed-source'

/** Bumped when a reader of the previous version can no longer read one. */
export const MANAGED_MANIFEST_VERSION = 1

export const MANAGED_MANIFEST_FILE = 'latest.json'

export interface ManagedFile {
  name: string
  /** Relative to the manifest's folder: `<version>/<name>`. */
  path: string
  size: number
  /** Hex SHA-256 of the file's bytes; a reader refuses a file that differs. */
  sha256: string
}

export interface ManagedManifest {
  format: typeof MANAGED_MANIFEST_FORMAT
  formatVersion: number
  sourceId: string
  name: string
  /** `YYYY.MM.DD-<checksum prefix>`: the build's date and its content. */
  version: string
  /** The song bundle's checksum, the same value as the release's `.sha256`. */
  checksum: string
  songCount: number
  /** ISO time the songs were computed. */
  builtAt: string
  /** The `.chsongs` archive and its other forms. */
  files: ManagedFile[]
  /** The versions kept in the bucket, newest first (this one included). */
  versions: string[]
}

/** What the app shows of a managed source's published copy. */
export type ManagedRelease = Pick<
  ManagedManifest,
  'version' | 'checksum' | 'songCount' | 'builtAt'
>
