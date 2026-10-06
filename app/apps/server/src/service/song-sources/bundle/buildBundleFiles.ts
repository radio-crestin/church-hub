import { readCategorySongs } from './readCategorySongs'
import {
  SONG_BUNDLE_FORMAT,
  SONG_BUNDLE_VERSION,
  type SongBundleFiles,
  type SongBundleManifestEntry,
} from './types'

/** Short content hash of a song file: equal hashes mean equal files. */
function hashFile(contents: string): string {
  return new Bun.CryptoHasher('sha256')
    .update(contents)
    .digest('hex')
    .slice(0, 16)
}

/** A category's songs as a bundle: one file per song plus the manifest. */
export function buildBundleFiles(
  categoryId: number,
  source: { name: string; categoryName: string },
): SongBundleFiles {
  const songFiles = new Map<string, string>()
  const entries: SongBundleManifestEntry[] = []

  for (const song of readCategorySongs(categoryId)) {
    const path = `songs/${encodeURIComponent(song.id)}.json`
    const contents = JSON.stringify(song)
    songFiles.set(path, contents)
    entries.push({
      id: song.id,
      title: song.title,
      path,
      hash: hashFile(contents),
    })
  }

  return {
    manifest: {
      format: SONG_BUNDLE_FORMAT,
      version: SONG_BUNDLE_VERSION,
      name: source.name,
      categoryName: source.categoryName,
      updatedAt: new Date().toISOString(),
      songs: entries,
    },
    songFiles,
  }
}
