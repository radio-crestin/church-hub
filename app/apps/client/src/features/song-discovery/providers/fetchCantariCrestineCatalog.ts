import { downloadFromUrl } from '~/features/song-import'
import {
  type CantariCrestineResponse,
  parseCantariCrestineCatalog,
} from './parseCantariCrestineCatalog'
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
  return parseCantariCrestineCatalog(source.id, response)
}
