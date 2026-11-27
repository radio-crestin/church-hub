import type { FeaturedSources } from './types'

/** A featured list as published; throws when it is not one. */
export function parseFeaturedSources(text: string): FeaturedSources {
  const featured = JSON.parse(text) as FeaturedSources
  if (
    featured?.format !== 'church-hub-featured-sources' ||
    featured.version !== 1 ||
    !Array.isArray(featured.sources)
  ) {
    throw new Error('Not a featured sources list')
  }
  return featured
}
