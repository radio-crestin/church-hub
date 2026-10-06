import JSZip from 'jszip'

import { fetchLink } from './fetchLink'
import { parseManifest } from '../bundle/parseManifest'
import { MANIFEST_FILE, type SongBundleFile } from '../bundle/types'

/** Every song file of a `.chsongs` file at a URL, in manifest order. */
export async function readBundleFile(url: string): Promise<SongBundleFile[]> {
  const zip = await JSZip.loadAsync(await fetchLink(url))
  const manifestText = await zip.file(MANIFEST_FILE)?.async('string')
  if (!manifestText) throw new Error('The file has no manifest.json')
  const manifest = parseManifest(manifestText)

  const files: SongBundleFile[] = []
  for (const entry of manifest.songs) {
    const xml = await zip.file(entry.path)?.async('string')
    if (xml) files.push({ id: entry.id, path: entry.path, xml })
  }
  return files
}
