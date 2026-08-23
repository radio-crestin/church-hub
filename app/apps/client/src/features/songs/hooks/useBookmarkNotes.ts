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

      // Songs and notes share one global sort sequence, so the new position of
      // a row is its index in the payload. The payload carries ROW ids — the
      // bookmark row id for songs, the note row id for notes — never the song
      // id; matching on anything else drops rows out of the cache and makes
      // bookmarked songs vanish from the list and lose their bookmark icon.
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
              positions.get(`song:${bookmark.id}`) ?? bookmark.sortOrder,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder)
        queryClient.setQueryData<SongBookmark[]>(
          SONG_BOOKMARKS_QUERY_KEY,
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
        queryClient.setQueryData<BookmarkNote[]>(
          BOOKMARK_NOTES_QUERY_KEY,
          reordered,
        )
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
    // refetchOnWindowFocus is off app-wide, so without this the optimistic
    // order is the only order the UI ever sees until a remount.
    onSettled: () => {
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
