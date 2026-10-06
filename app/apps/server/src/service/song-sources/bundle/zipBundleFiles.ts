import JSZip from 'jszip'

import { MANIFEST_FILE, type SongBundleFiles } from './types'

/** A bundle as one `.chsongs` file: a deflated ZIP of its layout. */
export function zipBundleFiles(bundle: SongBundleFiles): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file(MANIFEST_FILE, JSON.stringify(bundle.manifest, null, 2))
  for (const [path, contents] of bundle.songFiles) zip.file(path, contents)
  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  })
}
