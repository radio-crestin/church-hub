import { LIBRARY_BUNDLE_VERSION } from '@church-hub/song-formats'

import {
  SONG_BUNDLE_FORMAT,
  type SongBundleManifest,
} from './types'

/**
 * Reads a manifest, refusing anything that is not a bundle we can read: a
 * song bundle (version 2) or a shared library (version 3, its songs in
 * shards; see readLibraryFolder).
 */
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
  if (manifest.version > LIBRARY_BUNDLE_VERSION) {
    throw new Error('This song source needs a newer Church Hub')
  }
  return manifest
}
