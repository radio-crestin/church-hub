import type { SongSearchFilters } from './songFilterSql'
import { createResultCache } from '../../text-search/createResultCache'
import type { SongSearchResult } from '../types'

/** Recent song searches, by query, categories and filters. */
export const songSearchCache = createResultCache<SongSearchResult[]>(
  100,
  5 * 60 * 1000,
)

export function songSearchCacheKey(
  query: string,
  categoryIds: number[] | undefined,
  filters: SongSearchFilters | undefined,
): string {
  const categoryKey = categoryIds ? [...categoryIds].sort().join(',') : 'all'
  const filterKey = [
    filters?.presentedOnly ? 'p' : '',
    filters?.inSchedulesOnly ? 's' : '',
    filters?.hasKeyLine ? 'k' : '',
    filters?.tagIds?.length ? `t${[...filters.tagIds].sort().join('.')}` : '',
  ].join('')
  return `${query.toLowerCase().trimStart()}:${categoryKey}:${filterKey}`
}
