import { useMemo } from 'react'

import { useSimilarSongs } from './useSimilarSongs'
import { isDismissed } from '../utils/dismissedSuggestions'

/**
 * Counts how many server-side version suggestions haven't been dismissed
 * yet on this device. Used by the song detail layout to:
 *  - badge the "Versiuni" accordion header,
 *  - auto-expand the Versions section the first time a song is opened
 *    when there's something worth seeing.
 *
 * Reads the `useSimilarSongs` cache so it doesn't trigger an extra fetch.
 *
 * NOTE: `dismissTick` is intentionally NOT a dep — localStorage isn't
 * reactive. The page reads it once on mount, and the SuggestionsSection
 * forces its own re-render after a dismiss; the badge updates on the
 * next render naturally because the localStorage read happens fresh.
 */
export function useUndismissedSuggestionCount(songId: number | null): number {
  const { data: suggestions = [] } = useSimilarSongs(songId, 5)

  return useMemo(() => {
    if (songId === null) return 0
    return suggestions.filter((s) => !isDismissed(songId, s.songId)).length
  }, [songId, suggestions])
}
