import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { getSongsPaginated, type PaginatedSongsResult } from '../service'

const PAGE_SIZE = 50

export function useSongsInfinite(categoryId?: number) {
  const queryClient = useQueryClient()

  const query = useInfiniteQuery<PaginatedSongsResult>({
    queryKey: ['songs', 'infinite', categoryId],
    queryFn: ({ pageParam, signal }) =>
      getSongsPaginated(PAGE_SIZE, pageParam as number, categoryId, signal),
    getNextPageParam: (lastPage, _, lastPageParam) =>
      lastPage.hasMore ? (lastPageParam as number) + PAGE_SIZE : undefined,
    initialPageParam: 0,
  })

  // Preload next page when we have data and there's more to load
  useEffect(() => {
    if (query.data && query.hasNextPage && !query.isFetchingNextPage) {
      const nextOffset = (
        query.data.pages.length > 0 ? query.data.pages.length * PAGE_SIZE : 0
      ) as number

      // Prefetch the next page
      queryClient.prefetchInfiniteQuery({
        queryKey: ['songs', 'infinite', categoryId],
        queryFn: ({ signal }) =>
          getSongsPaginated(PAGE_SIZE, nextOffset, categoryId, signal),
        initialPageParam: 0,
        getNextPageParam: (lastPage: PaginatedSongsResult) =>
          lastPage.hasMore ? nextOffset + PAGE_SIZE : undefined,
        pages: 1,
      })
    }
  }, [
    query.data,
    query.hasNextPage,
    query.isFetchingNextPage,
    categoryId,
    queryClient,
  ])

  return query
}
