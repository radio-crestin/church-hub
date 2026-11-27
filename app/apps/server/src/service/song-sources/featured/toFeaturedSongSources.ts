import type { FeaturedList } from './types'
import type { SongSource } from '../types'

/** The featured libraries as song sources, read like any shared folder. */
export function toFeaturedSongSources(list: FeaturedList): SongSource[] {
  return list.featured.sources.map((source) => ({
    id: source.sourceId,
    name: source.name,
    categoryName: source.categoryName,
    format: 'song-bundle-folder',
    url: new URL(`${source.sourceId}/manifest.json`, list.url).toString(),
    ...(source.homepage && { homepage: source.homepage }),
    ...(source.license && { license: source.license }),
    origin: 'built-in',
  }))
}
