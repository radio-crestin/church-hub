import {
  type CantariCrestineResponse,
  parseCantariCrestineSongs,
} from '@church-hub/song-formats'

import { downloadFromUrl } from '~/features/song-import'
import { sourceSongsToCandidates } from './sourceSongsToCandidates'
import type { FetchCatalog } from './types'

/**
 * One hymnal from cantaricrestine.ro's JSON API (the config's URL names the
 * hymnal and asks for every song on one page), through the server proxy.
 */
export const fetchCantariCrestineCatalog: FetchCatalog = async (
  source,
  onProgress,
) => {
  const report = (current: number, total: number | null) =>
    onProgress?.({
      phase: 'downloading',
      current,
      total,
      currentFile: source.name,
    })

  report(0, null)
  const body = await downloadFromUrl(source.url, report)
  const response = JSON.parse(
    new TextDecoder().decode(body),
  ) as CantariCrestineResponse
  return sourceSongsToCandidates(source.id, parseCantariCrestineSongs(response))
}
