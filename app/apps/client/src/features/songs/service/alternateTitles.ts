import { fetcher } from '../../../utils/fetcher'

/** One source file and the names the source knows that song by. */
export interface AlternateTitleEntry {
  sourceFilename: string
  titles: string[]
}

export interface AlternateTitlesBackfill {
  /** Entries that found at least one song in the library. */
  matched: number
  /** Songs that gained a name they did not already have. */
  updated: number
}

/** Matches the server's own ceiling for one request. */
const CHUNK_SIZE = 500

/**
 * Gives songs already in the library back the names their source knows them by,
 * matching on the source filename the import recorded.
 *
 * Sent in chunks so one catalogue does not become one enormous request, and the
 * totals are added up across them.
 */
export async function backfillAlternateTitles(
  entries: AlternateTitleEntry[],
  onProgress?: (done: number, total: number) => void,
): Promise<AlternateTitlesBackfill> {
  const totals: AlternateTitlesBackfill = { matched: 0, updated: 0 }

  for (let index = 0; index < entries.length; index += CHUNK_SIZE) {
    const chunk = entries.slice(index, index + CHUNK_SIZE)
    const response = await fetcher<{
      data?: AlternateTitlesBackfill
      error?: string
    }>('/api/songs/alternate-titles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: chunk }),
    })

    if (response.error || !response.data) {
      throw new Error(response.error ?? 'Backfill failed')
    }
    totals.matched += response.data.matched
    totals.updated += response.data.updated
    onProgress?.(Math.min(index + CHUNK_SIZE, entries.length), entries.length)
  }

  return totals
}
