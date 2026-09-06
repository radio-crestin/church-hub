import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { BOOKMARK_NOTES_QUERY_KEY } from './useBookmarkNotes'
import {
  addBookmark,
  clearBookmarks,
  getBookmarks,
  markBookmarkSung,
  removeBookmark,
  type SongBookmark,
} from '../service'

export const SONG_BOOKMARKS_QUERY_KEY = ['song-bookmarks']

export function useSongBookmarks() {
  return useQuery<SongBookmark[]>({
    queryKey: SONG_BOOKMARKS_QUERY_KEY,
    queryFn: getBookmarks,
  })
}

// Placeholder ids for rows added optimistically, before the server assigns a
// real one. Always negative — real ids from the DB start at 1 — so callers
// can tell "still in flight" apart from "confirmed" with a single `id < 0`
// check, without any extra pending-state bookkeeping.
let nextTempBookmarkId = -1

/** Only the last of several overlapping add/remove mutations reconciles with
 *  the server. If every mutation invalidated on its own settle, an earlier
 *  settle could refetch while a later one is still in flight and briefly
 *  resurrect the state the later mutation just optimistically changed. */
function reconcileWhenIdle(queryClient: ReturnType<typeof useQueryClient>) {
  if (queryClient.isMutating({ mutationKey: SONG_BOOKMARKS_QUERY_KEY }) === 0) {
    queryClient.invalidateQueries({ queryKey: SONG_BOOKMARKS_QUERY_KEY })
  }
}

export function useAddBookmark() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: [...SONG_BOOKMARKS_QUERY_KEY, 'add'],
    mutationFn: (songId: number) => addBookmark(songId),
    // Optimistic insert so the row's bookmark icon flips before the round
    // trip, instead of waiting on POST + refetch of the whole list.
    onMutate: async (songId) => {
      await queryClient.cancelQueries({ queryKey: SONG_BOOKMARKS_QUERY_KEY })
      const tempId = nextTempBookmarkId--
      queryClient.setQueryData<SongBookmark[]>(
        SONG_BOOKMARKS_QUERY_KEY,
        (old = []) => [
          ...old,
          {
            id: tempId,
            songId,
            // Filled in once the server responds (onSuccess swaps this row
            // for the real one) or once onSettled's invalidate refetches —
            // whichever lands first. Blank only for the one round trip.
            songTitle: '',
            songCategoryName: null,
            songKeyLine: null,
            songTagNames: [],
            sortOrder: old.length
              ? Math.max(...old.map((b) => b.sortOrder)) + 1
              : 0,
            isSung: false,
            sungAt: null,
            createdAt: Date.now(),
          },
        ],
      )
      return { tempId }
    },
    onSuccess: (data, _songId, context) => {
      if (!data) return
      queryClient.setQueryData<SongBookmark[]>(
        SONG_BOOKMARKS_QUERY_KEY,
        (old = []) => old.map((b) => (b.id === context.tempId ? data : b)),
      )
    },
    onError: (_err, _songId, context) => {
      queryClient.setQueryData<SongBookmark[]>(
        SONG_BOOKMARKS_QUERY_KEY,
        (old = []) => old.filter((b) => b.id !== context?.tempId),
      )
    },
    onSettled: () => reconcileWhenIdle(queryClient),
  })
}

export function useRemoveBookmark() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: [...SONG_BOOKMARKS_QUERY_KEY, 'remove'],
    mutationFn: (bookmarkId: number) => removeBookmark(bookmarkId),
    // Optimistic removal, mirroring useAddBookmark. Rolls back only the one
    // row it removed rather than restoring a whole-list snapshot, so an
    // overlapping add/remove on a different row is never clobbered.
    onMutate: async (bookmarkId) => {
      await queryClient.cancelQueries({ queryKey: SONG_BOOKMARKS_QUERY_KEY })
      const previous = queryClient.getQueryData<SongBookmark[]>(
        SONG_BOOKMARKS_QUERY_KEY,
      )
      const removed = previous?.find((b) => b.id === bookmarkId)
      queryClient.setQueryData<SongBookmark[]>(
        SONG_BOOKMARKS_QUERY_KEY,
        (old = []) => old.filter((b) => b.id !== bookmarkId),
      )
      return { removed }
    },
    onError: (_err, _bookmarkId, context) => {
      if (!context?.removed) return
      const removed = context.removed
      queryClient.setQueryData<SongBookmark[]>(
        SONG_BOOKMARKS_QUERY_KEY,
        (old = []) =>
          old.some((b) => b.id === removed.id) ? old : [...old, removed],
      )
    },
    onSettled: () => reconcileWhenIdle(queryClient),
  })
}

export function useClearBookmarks() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: clearBookmarks,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SONG_BOOKMARKS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: BOOKMARK_NOTES_QUERY_KEY })
    },
  })
}

export function useMarkBookmarkSung() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      bookmarkId,
      isSung,
    }: {
      bookmarkId: number
      isSung: boolean
    }) => markBookmarkSung(bookmarkId, isSung),
    // Optimistic toggle so the button feels instant.
    onMutate: async ({ bookmarkId, isSung }) => {
      await queryClient.cancelQueries({ queryKey: SONG_BOOKMARKS_QUERY_KEY })
      const previous = queryClient.getQueryData<SongBookmark[]>(
        SONG_BOOKMARKS_QUERY_KEY,
      )
      if (previous) {
        queryClient.setQueryData<SongBookmark[]>(
          SONG_BOOKMARKS_QUERY_KEY,
          previous.map((b) =>
            b.id === bookmarkId
              ? { ...b, isSung, sungAt: isSung ? Date.now() : null }
              : b,
          ),
        )
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(SONG_BOOKMARKS_QUERY_KEY, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SONG_BOOKMARKS_QUERY_KEY })
    },
  })
}
