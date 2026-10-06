import { useMutation, useQueryClient } from '@tanstack/react-query'

import { SONG_BOOKMARKS_QUERY_KEY } from './useSongBookmarks'
import { addBookmark, getBookmarks } from '../service'

export interface AddSongsToBookmarksResult {
  added: number
  alreadyMarked: number
}

/**
 * Marks several songs at once, in the order given, after the ones already in
 * Marcaje. A song already marked is not added again, so loading the same
 * program twice does not double the list.
 */
export function useAddSongsToBookmarks() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: [...SONG_BOOKMARKS_QUERY_KEY, 'add-many'],
    mutationFn: async (
      songIds: number[],
    ): Promise<AddSongsToBookmarksResult> => {
      const marked = new Set((await getBookmarks()).map((b) => b.songId))
      let added = 0
      for (const songId of songIds) {
        if (marked.has(songId)) continue
        const bookmark = await addBookmark(songId)
        if (!bookmark) throw new Error(`Could not mark song ${songId}`)
        marked.add(songId)
        added += 1
      }
      return { added, alreadyMarked: songIds.length - added }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: SONG_BOOKMARKS_QUERY_KEY }),
  })
}
