import JSZip from 'jszip'

import { parseManifest } from './parseManifest'
import { MANIFEST_FILE } from './types'

/**
 * The checksum in a `.chsongs` archive's manifest. Every entry is checked
 * against its CRC-32 first, so a damaged download throws instead of
 * importing broken songs.
 */
export async function readArchiveChecksum(
  archive: Uint8Array,
): Promise<string> {
  const zip = await JSZip.loadAsync(archive, { checkCRC32: true })
  const text = await zip.file(MANIFEST_FILE)?.async('string')
  if (!text) throw new Error('The song file has no manifest.json')
  return parseManifest(text).checksum
}
