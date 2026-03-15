import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { SONG_BOOKMARKS_QUERY_KEY } from './useSongBookmarks'
import {
  addBookmarkNote,
  type BookmarkItemRef,
  type BookmarkNote,
  exportBookmarksAsText,
  getBookmarkNotes,
  removeBookmarkNote,
  reorderBookmarkItems,
  type SongBookmark,
  updateBookmarkNote,
} from '../service'

export const BOOKMARK_NOTES_QUERY_KEY = ['bookmark-notes']

export function useBookmarkNotes() {
  return useQuery<BookmarkNote[]>({
    queryKey: BOOKMARK_NOTES_QUERY_KEY,
    queryFn: getBookmarkNotes,
  })
}

export function useAddBookmarkNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (content: string) => addBookmarkNote(content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOKMARK_NOTES_QUERY_KEY })
    },
  })
}

export function useUpdateBookmarkNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      updateBookmarkNote(id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOKMARK_NOTES_QUERY_KEY })
    },
  })
}

export function useRemoveBookmarkNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => removeBookmarkNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOKMARK_NOTES_QUERY_KEY })
    },
  })
}

export function useReorderBookmarkItems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (items: BookmarkItemRef[]) => reorderBookmarkItems(items),
    onMutate: async (items: BookmarkItemRef[]) => {
      await queryClient.cancelQueries({ queryKey: SONG_BOOKMARKS_QUERY_KEY })
      await queryClient.cancelQueries({ queryKey: BOOKMARK_NOTES_QUERY_KEY })

      const previousBookmarks = queryClient.getQueryData<SongBookmark[]>(
        SONG_BOOKMARKS_QUERY_KEY,
      )
      const previousNotes = queryClient.getQueryData<BookmarkNote[]>(
        BOOKMARK_NOTES_QUERY_KEY,
      )

      if (previousBookmarks) {
        const reordered = items
          .filter((item) => item.type === 'song')
          .map((item, _idx) => {
            const bookmark = previousBookmarks.find((b) => b.songId === item.id)
            return bookmark
              ? {
                  ...bookmark,
                  sortOrder: items.findIndex(
                    (i) => i.type === 'song' && i.id === item.id,
                  ),
                }
              : undefined
          })
          .filter((b): b is SongBookmark => b !== undefined)
        queryClient.setQueryData(SONG_BOOKMARKS_QUERY_KEY, reordered)
      }

      if (previousNotes) {
        const reordered = items
          .filter((item) => item.type === 'note')
          .map((item) => {
            const note = previousNotes.find((n) => n.id === item.id)
            return note
              ? {
                  ...note,
                  sortOrder: items.findIndex(
                    (i) => i.type === 'note' && i.id === item.id,
                  ),
                }
              : undefined
          })
          .filter((n): n is BookmarkNote => n !== undefined)
        queryClient.setQueryData(BOOKMARK_NOTES_QUERY_KEY, reordered)
      }

      return { previousBookmarks, previousNotes }
    },
    onError: (_err, _items, context) => {
      if (context?.previousBookmarks) {
        queryClient.setQueryData(
          SONG_BOOKMARKS_QUERY_KEY,
          context.previousBookmarks,
        )
      }
      if (context?.previousNotes) {
        queryClient.setQueryData(
          BOOKMARK_NOTES_QUERY_KEY,
          context.previousNotes,
        )
      }
      queryClient.invalidateQueries({ queryKey: SONG_BOOKMARKS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: BOOKMARK_NOTES_QUERY_KEY })
    },
  })
}

export function useExportBookmarksAsText() {
  return useMutation({
    mutationFn: exportBookmarksAsText,
  })
}
