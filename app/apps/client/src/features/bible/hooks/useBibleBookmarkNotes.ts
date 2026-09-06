import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  BIBLE_BOOKMARK_NOTES_QUERY_KEY,
  BIBLE_BOOKMARKS_QUERY_KEY,
} from './bibleBookmarkKeys'
import {
  addBookmarkNote,
  type BibleBookmark,
  type BibleBookmarkItemRef,
  type BibleBookmarkNote,
  exportBookmarksAsText,
  getBookmarkNotes,
  importBookmarksFromText,
  removeBookmarkNote,
  reorderBookmarkItems,
  updateBookmarkNote,
} from '../service'

export { BIBLE_BOOKMARK_NOTES_QUERY_KEY }

export function useBibleBookmarkNotes() {
  return useQuery<BibleBookmarkNote[]>({
    queryKey: BIBLE_BOOKMARK_NOTES_QUERY_KEY,
    queryFn: getBookmarkNotes,
  })
}

export function useAddBibleBookmarkNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (content: string) => addBookmarkNote(content),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: BIBLE_BOOKMARK_NOTES_QUERY_KEY,
      })
    },
  })
}

export function useUpdateBibleBookmarkNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      updateBookmarkNote(id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: BIBLE_BOOKMARK_NOTES_QUERY_KEY,
      })
    },
  })
}

export function useRemoveBibleBookmarkNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => removeBookmarkNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: BIBLE_BOOKMARK_NOTES_QUERY_KEY,
      })
    },
  })
}

export function useReorderBibleBookmarkItems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (items: BibleBookmarkItemRef[]) => reorderBookmarkItems(items),
    onMutate: async (items: BibleBookmarkItemRef[]) => {
      await queryClient.cancelQueries({ queryKey: BIBLE_BOOKMARKS_QUERY_KEY })
      await queryClient.cancelQueries({
        queryKey: BIBLE_BOOKMARK_NOTES_QUERY_KEY,
      })

      const previousBookmarks = queryClient.getQueryData<BibleBookmark[]>(
        BIBLE_BOOKMARKS_QUERY_KEY,
      )
      const previousNotes = queryClient.getQueryData<BibleBookmarkNote[]>(
        BIBLE_BOOKMARK_NOTES_QUERY_KEY,
      )

      // Verses and notes share one ordering sequence, so a row's new position
      // is its index in the payload. The payload carries ROW ids - the
      // bookmark row id for verses, the note row id for notes - never the
      // verse id; matching on anything else drops rows out of the cache and
      // makes bookmarked verses vanish from the list.
      const positions = new Map(
        items.map((item, index) => [`${item.type}:${item.id}`, index]),
      )

      // Rows the payload does not mention keep their current sortOrder instead
      // of being filtered out, so a partial payload can never empty the cache.
      if (previousBookmarks) {
        const reordered = previousBookmarks
          .map((bookmark) => ({
            ...bookmark,
            sortOrder:
              positions.get(`verse:${bookmark.id}`) ?? bookmark.sortOrder,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder)
        queryClient.setQueryData<BibleBookmark[]>(
          BIBLE_BOOKMARKS_QUERY_KEY,
          reordered,
        )
      }

      if (previousNotes) {
        const reordered = previousNotes
          .map((note) => ({
            ...note,
            sortOrder: positions.get(`note:${note.id}`) ?? note.sortOrder,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder)
        queryClient.setQueryData<BibleBookmarkNote[]>(
          BIBLE_BOOKMARK_NOTES_QUERY_KEY,
          reordered,
        )
      }

      return { previousBookmarks, previousNotes }
    },
    onError: (_err, _items, context) => {
      if (context?.previousBookmarks) {
        queryClient.setQueryData(
          BIBLE_BOOKMARKS_QUERY_KEY,
          context.previousBookmarks,
        )
      }
      if (context?.previousNotes) {
        queryClient.setQueryData(
          BIBLE_BOOKMARK_NOTES_QUERY_KEY,
          context.previousNotes,
        )
      }
      queryClient.invalidateQueries({ queryKey: BIBLE_BOOKMARKS_QUERY_KEY })
      queryClient.invalidateQueries({
        queryKey: BIBLE_BOOKMARK_NOTES_QUERY_KEY,
      })
    },
    // refetchOnWindowFocus is off app-wide, so without this the optimistic
    // order is the only order the UI ever sees until a remount.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BIBLE_BOOKMARKS_QUERY_KEY })
      queryClient.invalidateQueries({
        queryKey: BIBLE_BOOKMARK_NOTES_QUERY_KEY,
      })
    },
  })
}

export function useExportBibleBookmarksAsText() {
  return useMutation({
    mutationFn: exportBookmarksAsText,
  })
}

export function useImportBibleBookmarksFromText() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      text,
      translationId,
    }: {
      text: string
      translationId?: number
    }) => importBookmarksFromText(text, translationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BIBLE_BOOKMARKS_QUERY_KEY })
      queryClient.invalidateQueries({
        queryKey: BIBLE_BOOKMARK_NOTES_QUERY_KEY,
      })
    },
  })
}
