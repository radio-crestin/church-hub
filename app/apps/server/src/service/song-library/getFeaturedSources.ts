import { type FeaturedSource, getFeaturedList } from '../song-sources/featured'

/** The sources every app is offered, as this app last read them. */
export function getFeaturedSources(): FeaturedSource[] {
  return getFeaturedList()?.featured.sources ?? []
}
