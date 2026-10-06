import JSZip from 'jszip'

import type { SongBundleSong } from '../providers/types'

const SONG_BUNDLE_FORMAT = 'church-hub-song-bundle'
const SUPPORTED_VERSION = 1

/** Mirrors the server's `SongBundleManifest` (bundle/types.ts). */
interface SongBundleManifest {
  format: string
  version: number
  name: string
  categoryName: string
  songs: Array<{ id: string; path: string }>
}

export interface SongBundleFile {
  name: string
  categoryName: string
  songs: SongBundleSong[]
}

/** Reads a `.chsongs` file: its manifest, then every song it lists. */
export async function readSongBundleFile(
  data: ArrayBuffer | Uint8Array,
): Promise<SongBundleFile> {
  const zip = await JSZip.loadAsync(data)
  const manifestText = await zip.file('manifest.json')?.async('string')
  if (!manifestText) throw new Error('Not a Church Hub song file')
  const manifest = JSON.parse(manifestText) as SongBundleManifest
  if (manifest.format !== SONG_BUNDLE_FORMAT) {
    throw new Error('Not a Church Hub song file')
  }
  if (manifest.version > SUPPORTED_VERSION) {
    throw new Error('This song file needs a newer Church Hub')
  }

  const songs: SongBundleSong[] = []
  for (const entry of manifest.songs) {
    const text = await zip.file(entry.path)?.async('string')
    if (text) songs.push(JSON.parse(text))
  }
  return { name: manifest.name, categoryName: manifest.categoryName, songs }
}
