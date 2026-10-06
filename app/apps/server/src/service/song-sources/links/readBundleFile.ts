import JSZip from 'jszip'

import { fetchLink } from './fetchLink'
import { parseManifest } from '../bundle/parseManifest'
import { MANIFEST_FILE, type SongBundleSong } from '../bundle/types'

/** Every song of a `.chsongs` file at a URL, in manifest order. */
export async function readBundleFile(url: string): Promise<SongBundleSong[]> {
  const zip = await JSZip.loadAsync(await fetchLink(url))
  const manifestText = await zip.file(MANIFEST_FILE)?.async('string')
  if (!manifestText) throw new Error('The file has no manifest.json')
  const manifest = parseManifest(manifestText)

  const songs: SongBundleSong[] = []
  for (const entry of manifest.songs) {
    const text = await zip.file(entry.path)?.async('string')
    if (text) songs.push(JSON.parse(text))
  }
  return songs
}
