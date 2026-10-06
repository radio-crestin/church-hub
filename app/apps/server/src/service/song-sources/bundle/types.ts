/**
 * A song bundle: one song source's songs, readable by any Church Hub and,
 * song by song, by any OpenSong reader.
 *
 * Laid out the same way in both of its forms:
 *   manifest.json            the source's name and one entry per song, with hash
 *   <song file>.opensong     one OpenSong file per song, named after the song
 * - as a file: a ZIP of that layout, with the `.chsongs` extension (or `.zip`,
 *   the same bytes, for other programs);
 * - as a folder: those objects in an S3 bucket, shared by the public URL of
 *   its manifest.json. Each song is its own object, so a change uploads only
 *   that song, and a reader learns what changed from the manifest's hashes.
 */
export const SONG_BUNDLE_FORMAT = 'church-hub-song-bundle'

/** Bumped when a reader of the previous version can no longer read a bundle. */
export const SONG_BUNDLE_VERSION = 2

export const SONG_BUNDLE_EXTENSION = '.chsongs'
export const MANIFEST_FILE = 'manifest.json'

export interface SongBundleManifestEntry {
  /** The song's identity across re-publishes (its uuid). */
  id: string
  title: string
  /** Path of the song's OpenSong file, relative to the manifest. */
  path: string
  /** Changes whenever anything in the song's file changes. */
  hash: string
}

export interface SongBundleManifest {
  format: typeof SONG_BUNDLE_FORMAT
  version: number
  name: string
  categoryName: string
  /** ISO time the bundle was built. */
  updatedAt: string
  songs: SongBundleManifestEntry[]
}

/** A bundle in memory: its manifest and each song's file contents by path. */
export interface SongBundleFiles {
  manifest: SongBundleManifest
  songFiles: Map<string, string>
}

/** One song file as read from a bundle: the client parses its OpenSong. */
export interface SongBundleFile {
  id: string
  path: string
  xml: string
}
