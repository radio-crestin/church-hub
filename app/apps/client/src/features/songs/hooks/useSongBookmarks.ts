import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  addBookmark,
  clearBookmarks,
  getBookmarks,
  removeBookmark,
  reorderBookmarks,
  type SongBookmark,
} from '../service'

export const SONG_BOOKMARKS_QUERY_KEY = ['song-bookmarks']

export function useSongBookmarks() {
  return useQuery<SongBookmark[]>({
    queryKey: SONG_BOOKMARKS_QUERY_KEY,
    queryFn: getBookmarks,
  })
}

export function useAddBookmark() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (songId: number) => addBookmark(songId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SONG_BOOKMARKS_QUERY_KEY })
    },
  })
}

export function useRemoveBookmark() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (songId: number) => removeBookmark(songId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SONG_BOOKMARKS_QUERY_KEY })
    },
  })
}

export function useClearBookmarks() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: clearBookmarks,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SONG_BOOKMARKS_QUERY_KEY })
    },
  })
}

export function useReorderBookmarks() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (songIds: number[]) => reorderBookmarks(songIds),
    onMutate: async (songIds: number[]) => {
      await queryClient.cancelQueries({ queryKey: SONG_BOOKMARKS_QUERY_KEY })
      const previous =
        queryClient.getQueryData<SongBookmark[]>(SONG_BOOKMARKS_QUERY_KEY)

      if (previous) {
        const reordered = songIds
          .map((id) => previous.find((b) => b.songId === id))
          .filter((b): b is SongBookmark => b !== undefined)
        queryClient.setQueryData(SONG_BOOKMARKS_QUERY_KEY, reordered)
      }

      return { previous }
    },
    onError: (_err, _songIds, context) => {
      if (context?.previous) {
        queryClient.setQueryData(SONG_BOOKMARKS_QUERY_KEY, context.previous)
      }
      queryClient.invalidateQueries({ queryKey: SONG_BOOKMARKS_QUERY_KEY })
    },
  })
}
