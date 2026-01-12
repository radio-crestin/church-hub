import { useInfiniteQuery } from '@tanstack/react-query'

import {
  getSongsPaginated,
  type PaginatedSongsResult,
} from '../../songs/service'

const PAGE_SIZE = 30

export const presentedSongsQueryKey = ['songs', 'presented', 'infinite']

export function usePresentedSongs() {
  return useInfiniteQuery<PaginatedSongsResult>({
    queryKey: presentedSongsQueryKey,
    queryFn: ({ pageParam, signal }) =>
      getSongsPaginated(
        PAGE_SIZE,
        pageParam as number,
        { presentedOnly: true },
        signal,
      ),
    getNextPageParam: (lastPage, _, lastPageParam) =>
      lastPage.hasMore ? (lastPageParam as number) + PAGE_SIZE : undefined,
    initialPageParam: 0,
    refetchInterval: 10000,
    staleTime: 5000,
  })
}
