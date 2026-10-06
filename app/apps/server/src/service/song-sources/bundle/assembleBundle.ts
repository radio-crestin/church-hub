import {
  SONG_BUNDLE_FORMAT,
  SONG_BUNDLE_VERSION,
  type SongBundleFiles,
  type SongBundleManifestEntry,
} from './types'

/** One song going into a bundle: its identity, file name and OpenSong file. */
export interface BundleSongInput {
  id: string
  title: string
  /** File name without extension; made unique within the bundle. */
  baseName: string
  xml: string
}

/** Short content hash: equal hashes mean equal contents. */
export function shortHash(contents: string): string {
  return new Bun.CryptoHasher('sha256')
    .update(contents)
    .digest('hex')
    .slice(0, 16)
}

/**
 * A bundle from its songs: one `<name>.opensong` file each, plus a manifest
 * with every song's hash and a checksum of the whole source, which changes
 * exactly when any song (or the source's name) does.
 */
export function assembleBundle(
  source: { name: string; categoryName: string },
  songs: BundleSongInput[],
): SongBundleFiles {
  const songFiles = new Map<string, string>()
  const taken = new Set<string>()
  const entries: SongBundleManifestEntry[] = []

  for (const song of songs) {
    let path = `${song.baseName}.opensong`
    for (let n = 2; taken.has(path.toLowerCase()); n++) {
      path = `${song.baseName} (${n}).opensong`
    }
    taken.add(path.toLowerCase())
    songFiles.set(path, song.xml)
    entries.push({
      id: song.id,
      title: song.title,
      path,
      hash: shortHash(song.xml),
    })
  }

  return {
    manifest: {
      format: SONG_BUNDLE_FORMAT,
      version: SONG_BUNDLE_VERSION,
      name: source.name,
      categoryName: source.categoryName,
      checksum: shortHash(JSON.stringify([source, entries])),
      updatedAt: new Date().toISOString(),
      songs: entries,
    },
    songFiles,
  }
}
