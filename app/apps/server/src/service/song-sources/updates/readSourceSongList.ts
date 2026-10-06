import {
  bundleFilesToSongs,
  type CantariCrestineResponse,
  parseCantariCrestineSongs,
  readSongBundleZip,
  type SourceSong,
} from '@church-hub/song-formats'

import { fetchLink } from '../links/fetchLink'
import { readBundleFolder } from '../links/readBundleFolder'
import type { SongSource } from '../types'

/** Every song of a source, downloaded and read on the server. */
export async function readSourceSongList(
  source: SongSource,
): Promise<SourceSong[]> {
  switch (source.format) {
    case 'cantaricrestine-api': {
      const body = new TextDecoder().decode(await fetchLink(source.url))
      return parseCantariCrestineSongs(
        JSON.parse(body) as CantariCrestineResponse,
      )
    }
    case 'song-bundle-file': {
      const { files, ownFormat } = await readSongBundleZip(
        await fetchLink(source.url),
      )
      return bundleFilesToSongs(files, { exactTitle: ownFormat })
    }
    case 'song-bundle-folder':
      return bundleFilesToSongs(await readBundleFolder(source.url), {
        exactTitle: true,
      })
  }
}
