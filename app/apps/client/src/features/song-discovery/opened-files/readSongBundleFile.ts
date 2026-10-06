import { isOpenSongXml, mightBeOpenSongFile } from '@church-hub/song-formats'
import JSZip from 'jszip'

import type { SongBundleFile } from '../providers/types'

const SONG_BUNDLE_FORMAT = 'church-hub-song-bundle'
const SUPPORTED_VERSION = 2

/** Mirrors the server's `SongBundleManifest` (bundle/types.ts). */
interface SongBundleManifest {
  format: string
  version: number
  name: string
  categoryName: string
  songs: Array<{ id: string; path: string }>
}

/** A song archive as read: its source name, category and song files. */
export interface OpenedSongFile {
  name: string
  categoryName: string
  files: SongBundleFile[]
  /** True for Church Hub's own files (their titles are kept exactly). */
  ownFormat: boolean
}

/** A plain ZIP of OpenSong files (no manifest): every OpenSong entry. */
async function readPlainOpenSongZip(zip: JSZip): Promise<SongBundleFile[]> {
  const files: SongBundleFile[] = []
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !mightBeOpenSongFile(entry.name)) continue
    const xml = await entry.async('string')
    if (isOpenSongXml(xml))
      files.push({ id: entry.name, path: entry.name, xml })
  }
  return files
}

/**
 * Reads a song archive: a `.chsongs` file (its manifest, then every OpenSong
 * file it lists) or, without a manifest, any ZIP of OpenSong files.
 */
export async function readSongBundleFile(
  data: ArrayBuffer | Uint8Array,
): Promise<OpenedSongFile> {
  const zip = await JSZip.loadAsync(data)
  const manifestText = await zip.file('manifest.json')?.async('string')
  if (!manifestText) {
    return {
      name: '',
      categoryName: '',
      files: await readPlainOpenSongZip(zip),
      ownFormat: false,
    }
  }
  const manifest = JSON.parse(manifestText) as SongBundleManifest
  if (manifest.format !== SONG_BUNDLE_FORMAT) {
    throw new Error('Not a Church Hub song file')
  }
  if (manifest.version > SUPPORTED_VERSION) {
    throw new Error('This song file needs a newer Church Hub')
  }

  const files: SongBundleFile[] = []
  for (const entry of manifest.songs) {
    const xml = await zip.file(entry.path)?.async('string')
    if (xml) files.push({ id: entry.id, path: entry.path, xml })
  }
  return {
    name: manifest.name,
    categoryName: manifest.categoryName,
    files,
    ownFormat: true,
  }
}
