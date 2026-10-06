/**
 * A song bundle: one song source's songs, readable by any Church Hub.
 *
 * Laid out the same way in both of its forms:
 *   manifest.json        the source's name and one entry per song, with hash
 *   songs/<id>.json      one song (title, metadata, slides)
 * - as a file: a ZIP of that layout with the `.chsongs` extension;
 * - as a folder: those objects in an S3 bucket, shared by the public URL of
 *   its manifest.json. Each song is its own object, so a change uploads only
 *   that song, and a reader learns what changed from the manifest's hashes.
 */
export const SONG_BUNDLE_FORMAT = 'church-hub-song-bundle'

/** Bumped when a reader of the previous version can no longer read a bundle. */
export const SONG_BUNDLE_VERSION = 1

export const SONG_BUNDLE_EXTENSION = '.chsongs'
export const MANIFEST_FILE = 'manifest.json'

export interface SongBundleSlide {
  /** Slide HTML, as the song editor stores it. */
  content: string
  label: string | null
}

/** One song, stored at `songs/<id>.json`. */
export interface SongBundleSong {
  id: string
  title: string
  alternateTitles: string[]
  sourceFilename: string | null
  author: string | null
  copyright: string | null
  ccli: string | null
  tempo: string | null
  timeSignature: string | null
  theme: string | null
  altTheme: string | null
  hymnNumber: string | null
  keyLine: string | null
  presentationOrder: string | null
  slides: SongBundleSlide[]
}

export interface SongBundleManifestEntry {
  id: string
  title: string
  /** Path of the song's file, relative to the manifest. */
  path: string
  /** Changes whenever anything in the song's file changes. */
  hash: string
}

export interface SongBundleManifest {
  format: typeof SONG_BUNDLE_FORMAT
  version: number
  name: string
  categoryName: string
  /** ISO time of the last change. */
  updatedAt: string
  songs: SongBundleManifestEntry[]
}

/** A bundle in memory: its manifest and each song's file contents by path. */
export interface SongBundleFiles {
  manifest: SongBundleManifest
  songFiles: Map<string, string>
}
