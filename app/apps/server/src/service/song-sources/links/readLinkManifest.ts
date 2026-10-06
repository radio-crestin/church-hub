import JSZip from 'jszip'

import { fetchLink } from './fetchLink'
import { parseManifest } from '../bundle/parseManifest'
import { MANIFEST_FILE, type SongBundleManifest } from '../bundle/types'
import type { SongSourceFormat } from '../types'

const isZip = (bytes: Uint8Array) => bytes[0] === 0x50 && bytes[1] === 0x4b

/**
 * Reads what a shared link points to: a `.chsongs` file (a ZIP) or a
 * folder's manifest.json. Returns its manifest and which form it is.
 */
export async function readLinkManifest(url: string): Promise<{
  manifest: SongBundleManifest
  format: Extract<SongSourceFormat, 'song-bundle-file' | 'song-bundle-folder'>
}> {
  const bytes = await fetchLink(url)
  if (!isZip(bytes)) {
    return {
      manifest: parseManifest(new TextDecoder().decode(bytes)),
      format: 'song-bundle-folder',
    }
  }
  const zip = await JSZip.loadAsync(bytes)
  const manifestText = await zip.file(MANIFEST_FILE)?.async('string')
  if (!manifestText) throw new Error('The file has no manifest.json')
  return { manifest: parseManifest(manifestText), format: 'song-bundle-file' }
}
