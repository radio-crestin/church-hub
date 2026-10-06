import { sanitizeFilename } from '@church-hub/song-formats'

import { type CategorySong, readCategorySongs } from './readCategorySongs'
import { songToOpenSong } from './songToOpenSong'
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

/** The song's file name: its own file's name when it came from one, else its title. */
function baseName(song: CategorySong): string {
  const fromFile = song.sourceFilename
    ?.split(/[/\\]/)
    .pop()
    ?.replace(/\.[^.]+$/, '')
  return sanitizeFilename(fromFile || song.title) || `song-${song.id}`
}

/** A category's songs as a bundle: one OpenSong file per song plus the manifest. */
export function buildBundleFiles(
  categoryId: number,
  source: { name: string; categoryName: string },
): SongBundleFiles {
  const songFiles = new Map<string, string>()
  const taken = new Set<string>()
  const entries: SongBundleManifestEntry[] = []

  for (const song of readCategorySongs(categoryId)) {
    const base = baseName(song)
    let path = `${base}.opensong`
    for (let n = 2; taken.has(path.toLowerCase()); n++) {
      path = `${base} (${n}).opensong`
    }
    taken.add(path.toLowerCase())

    const contents = songToOpenSong(song)
    songFiles.set(path, contents)
    entries.push({
      id: song.uuid || `song-${song.id}`,
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
