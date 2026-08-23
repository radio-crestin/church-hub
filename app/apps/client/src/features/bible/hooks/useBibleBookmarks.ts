import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  BIBLE_BOOKMARK_NOTES_QUERY_KEY,
  BIBLE_BOOKMARKS_QUERY_KEY,
} from './bibleBookmarkKeys'
import {
  addBookmark,
  type BibleBookmark,
  type BibleBookmarkStyleRange,
  clearBookmarks,
  getBookmarks,
  removeBookmark,
} from '../service'

export { BIBLE_BOOKMARKS_QUERY_KEY }

export function useBibleBookmarks() {
  return useQuery<BibleBookmark[]>({
    queryKey: BIBLE_BOOKMARKS_QUERY_KEY,
    queryFn: getBookmarks,
  })
}

export function useAddBibleBookmark() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      verseId,
      styleRanges,
    }: {
      verseId: number
      styleRanges?: BibleBookmarkStyleRange[]
    }) => addBookmark(verseId, styleRanges),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BIBLE_BOOKMARKS_QUERY_KEY })
    },
  })
}

export function useRemoveBibleBookmark() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (bookmarkId: number) => removeBookmark(bookmarkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BIBLE_BOOKMARKS_QUERY_KEY })
    },
  })
}

export function useClearBibleBookmarks() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: clearBookmarks,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BIBLE_BOOKMARKS_QUERY_KEY })
      queryClient.invalidateQueries({
        queryKey: BIBLE_BOOKMARK_NOTES_QUERY_KEY,
      })
    },
  })
}
