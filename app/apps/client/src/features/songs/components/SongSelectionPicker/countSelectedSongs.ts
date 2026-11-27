import type { SongSelection } from './types'
import type { SongCategory } from '../../types'

/**
 * How many songs a selection holds, at most: its categories' songs plus the
 * songs picked one by one (one of them may also be in a picked category).
 */
export function countSelectedSongs(
  selection: SongSelection,
  categories: SongCategory[],
): number {
  const chosen = new Set(selection.categoryIds)
  const inCategories = categories
    .filter((category) => chosen.has(category.id))
    .reduce((sum, category) => sum + category.songCount, 0)
  return inCategories + selection.songs.length
}
