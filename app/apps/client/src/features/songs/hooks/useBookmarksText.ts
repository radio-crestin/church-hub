import { useMutation, useQueryClient } from '@tanstack/react-query'

import { BOOKMARK_NOTES_QUERY_KEY } from './useBookmarkNotes'
import { SONG_BOOKMARKS_QUERY_KEY } from './useSongBookmarks'
import { getBookmarksText, replaceBookmarksFromText } from '../service'

/** Loads the Marcaje as Markdown text, fresh each time the editor opens. */
export function useLoadBookmarksText() {
  return useMutation({ mutationFn: getBookmarksText })
}

/** Replaces the Marcaje from text; the list refreshes once it is applied. */
export function useReplaceBookmarksFromText() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: replaceBookmarksFromText,
    onSuccess: (result) => {
      if (!result.applied) return
      queryClient.invalidateQueries({ queryKey: SONG_BOOKMARKS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: BOOKMARK_NOTES_QUERY_KEY })
    },
  })
}
