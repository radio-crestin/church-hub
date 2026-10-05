import { foldTitle } from './foldTitle'
import { getDatabase } from '../../db'
import { songs } from '../../db/schema'
import { parseAlternateTitles } from '../songs/parseAlternateTitles'

/**
 * Looks up songs by title the way a person types one: case, diacritics and
 * punctuation do not matter. A song's own title wins over another song's
 * alternate title; among equals the oldest song wins.
 */
export function loadSongLookup(): {
  byId: Set<number>
  byTitle: (title: string) => number | undefined
} {
  const rows = getDatabase()
    .select({
      id: songs.id,
      title: songs.title,
      alternateTitles: songs.alternateTitles,
    })
    .from(songs)
    .orderBy(songs.id)
    .all()

  const titles = new Map<string, number>()
  const alternates = new Map<string, number>()
  for (const row of rows) {
    const key = foldTitle(row.title)
    if (!titles.has(key)) titles.set(key, row.id)
    for (const alternate of parseAlternateTitles(row.alternateTitles)) {
      const alternateKey = foldTitle(alternate)
      if (!alternates.has(alternateKey)) alternates.set(alternateKey, row.id)
    }
  }

  return {
    byId: new Set(rows.map((row) => row.id)),
    byTitle: (title) => {
      const key = foldTitle(title)
      return titles.get(key) ?? alternates.get(key)
    },
  }
}
