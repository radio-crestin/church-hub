import { parseAlternateTitles } from './parseAlternateTitles'
import { batchUpdateSearchIndex } from './search'
import { serializeAlternateTitles } from './serializeAlternateTitles'
import { getRawDatabase } from '../../db'
import { createLogger } from '../../utils/logger'

const logger = createLogger('songs')

/** One source file and the names the source knows that song by. */
export interface AlternateTitleEntry {
  sourceFilename: string
  titles: string[]
}

export interface BackfillAlternateTitlesResult {
  /** Entries that found at least one song in the library. */
  matched: number
  /** Songs that gained a name they did not already have. */
  updated: number
}

/**
 * Gives songs already in the library back the names their source knows them by.
 *
 * A library imported with "use the first verse as the title" filed every song
 * under its opening line, and the name the source gave it was thrown away —
 * "Zece mii de motive" is stored as "E o nouă zi, soarele răsare" and cannot be
 * found by the name anyone would actually search for. Imports keep it now; this
 * recovers it for everything imported before, matching on the source filename
 * the import recorded, which is the only link back to the file a song came from.
 *
 * A song already carrying the name is left alone, so the operation can be run
 * as often as the catalogue changes without churning the library.
 */
export function backfillAlternateTitles(
  entries: AlternateTitleEntry[],
): BackfillAlternateTitlesResult {
  if (entries.length === 0) return { matched: 0, updated: 0 }

  const db = getRawDatabase()
  const select = db.query<
    { id: number; title: string; alternate_titles: string | null },
    [string]
  >('SELECT id, title, alternate_titles FROM songs WHERE source_filename = ?')
  const update = db.query<never, [string | null, number]>(
    'UPDATE songs SET alternate_titles = ?, updated_at = unixepoch() WHERE id = ?',
  )

  const changedIds: number[] = []
  let matched = 0

  db.run('BEGIN TRANSACTION')
  try {
    for (const entry of entries) {
      const filename = entry.sourceFilename?.trim()
      if (!filename) continue

      const rows = select.all(filename)
      if (rows.length === 0) continue
      matched += 1

      for (const row of rows) {
        const known = new Set(
          [row.title, ...parseAlternateTitles(row.alternate_titles)].map(
            (name) => name.trim().toLowerCase(),
          ),
        )
        const additions = entry.titles.filter((title) => {
          const key = title?.trim().toLowerCase()
          return !!key && !known.has(key)
        })
        if (additions.length === 0) continue

        const next = serializeAlternateTitles([
          ...parseAlternateTitles(row.alternate_titles),
          ...additions,
        ])
        update.run(next, row.id)
        changedIds.push(row.id)
      }
    }
    db.run('COMMIT')
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  }

  // Outside the transaction: the index is rebuilt from the rows that were just
  // committed, and it keeps its own.
  if (changedIds.length > 0) {
    batchUpdateSearchIndex(changedIds)
  }

  logger.info(
    `Alternate titles backfill: ${matched} file(s) matched, ${changedIds.length} song(s) updated`,
  )
  return { matched, updated: changedIds.length }
}
