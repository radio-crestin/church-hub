import { useInfiniteQuery } from '@tanstack/react-query'

import { getSongsPaginated, type PaginatedSongsResult } from '../service'

const PAGE_SIZE = 50

export function useSongsInfinite(categoryId?: number) {
  // Note: Prefetching is handled by the IntersectionObserver in SongList.tsx
  // which triggers fetchNextPage() with a 200px rootMargin for preloading
  return useInfiniteQuery<PaginatedSongsResult>({
    queryKey: ['songs', 'infinite', categoryId],
    queryFn: ({ pageParam, signal }) =>
      getSongsPaginated(PAGE_SIZE, pageParam as number, categoryId, signal),
    getNextPageParam: (lastPage, _, lastPageParam) =>
      lastPage.hasMore ? (lastPageParam as number) + PAGE_SIZE : undefined,
    initialPageParam: 0,
    staleTime: 0,
  })
}
