import {
  SONG_BUNDLE_FORMAT,
  SONG_BUNDLE_VERSION,
  type SongBundleManifest,
} from './types'

/** Reads a manifest, refusing anything that is not a bundle we can read. */
export function parseManifest(text: string): SongBundleManifest {
  let manifest: SongBundleManifest
  try {
    manifest = JSON.parse(text)
  } catch {
    throw new Error('The link is not a Church Hub song source')
  }
  if (manifest?.format !== SONG_BUNDLE_FORMAT) {
    throw new Error('The link is not a Church Hub song source')
  }
  if (manifest.version > SONG_BUNDLE_VERSION) {
    throw new Error('This song source needs a newer Church Hub')
  }
  return manifest
}
