import type { Where, WhereDocument } from 'chromadb'

import { getChromaCollection } from './client'
import { getEmbedder } from './embedder'
import { highlightTerms } from './highlight'
import { normalizeForChromaDoc } from './normalize'
import type {
  BibleDocMetadata,
  ScheduleDocMetadata,
  SearchEngine,
  SongDocMetadata,
} from './types'
import { CHROMA_COLLECTIONS } from './types'
import { getRawDatabase } from '../../db'
import { createLogger } from '../../utils/logger'
import type { BibleSearchResult } from '../bible/types'
import type { ScheduleSearchResult } from '../schedules/types'
import type { SongSearchResult } from '../songs/types'

const logger = createLogger('chroma-search')

export type ChromaSearchMode = Extract<
  SearchEngine,
  'chroma-semantic' | 'chroma-keyword'
>

function queryTerms(query: string): string[] {
  return normalizeForChromaDoc(query).split(' ').filter(Boolean)
}

/** AND-combined $contains filter over all query terms. */
function buildWhereDocument(terms: string[]): WhereDocument | undefined {
  if (terms.length === 0) return undefined
  if (terms.length === 1) return { $contains: terms[0] as string }
  return { $and: terms.map((t) => ({ $contains: t })) }
}

function occurrenceScore(document: string, terms: string[]): number {
  let score = 0
  for (const term of terms) {
    let from = 0
    for (;;) {
      const at = document.indexOf(term, from)
      if (at === -1) break
      score += 1
      from = at + term.length
    }
  }
  return score
}

/** Cosine distance (0..2) → 0..100 similarity score. */
function distanceToScore(distance: number | null | undefined): number {
  if (distance == null) return 0
  return Math.round(Math.max(0, 1 - distance) * 100)
}

interface ChromaHit<M> {
  metadata: M
  document: string
  distance: number | null
}

/**
 * Runs either a semantic (vector) or keyword ($contains) lookup against a
 * collection and returns raw hits.
 */
async function runChromaLookup<M>(
  collectionName: (typeof CHROMA_COLLECTIONS)[keyof typeof CHROMA_COLLECTIONS],
  query: string,
  mode: ChromaSearchMode,
  nResults: number,
  where?: Where,
): Promise<ChromaHit<M>[]> {
  const collection = await getChromaCollection(collectionName)
  const terms = queryTerms(query)
  if (terms.length === 0) return []

  if (mode === 'chroma-semantic') {
    const embedder = await getEmbedder()
    const [queryEmbedding] = await embedder.generate([terms.join(' ')])
    const res = await collection.query({
      queryEmbeddings: [queryEmbedding as number[]],
      nResults,
      where,
      include: ['metadatas', 'documents', 'distances'],
    })
    const ids = res.ids?.[0] ?? []
    return ids.map((_, i) => ({
      metadata: res.metadatas?.[0]?.[i] as M,
      document: String(res.documents?.[0]?.[i] ?? ''),
      distance: res.distances?.[0]?.[i] ?? null,
    }))
  }

  const res = await collection.get({
    whereDocument: buildWhereDocument(terms),
    where,
    limit: nResults,
    include: ['metadatas', 'documents'],
  })
  const ids = res.ids ?? []
  return ids.map((_, i) => ({
    metadata: res.metadatas?.[i] as M,
    document: String(res.documents?.[i] ?? ''),
    distance: null,
  }))
}

// ---------------------------------------------------------------------------
// Songs
// ---------------------------------------------------------------------------

interface SongFilterOptions {
  presentedOnly?: boolean
  inSchedulesOnly?: boolean
  hasKeyLine?: boolean
}

interface SongDbRow {
  id: number
  title: string
  category_id: number | null
  category_name: string | null
  key_line: string | null
  presentation_count: number
}

/**
 * Fetches fresh song fields from SQLite for the candidate ids, applying the
 * same filters as the FTS path (filters live in the DB, not in Chroma
 * metadata, so they can never go stale).
 */
function fetchFilteredSongs(
  songIds: number[],
  categoryIds?: number[],
  filters?: SongFilterOptions,
): Map<number, SongDbRow> {
  if (songIds.length === 0) return new Map()
  const db = getRawDatabase()
  const conditions: string[] = [`s.id IN (${songIds.map(() => '?').join(',')})`]
  const params: number[] = [...songIds]
  if (categoryIds && categoryIds.length > 0) {
    conditions.push(
      `s.category_id IN (${categoryIds.map(() => '?').join(',')})`,
    )
    params.push(...categoryIds)
  }
  if (filters?.presentedOnly) {
    conditions.push('s.presentation_count > 0')
  }
  if (filters?.inSchedulesOnly) {
    conditions.push(
      's.id IN (SELECT DISTINCT song_id FROM schedule_items WHERE song_id IS NOT NULL)',
    )
  }
  if (filters?.hasKeyLine) {
    conditions.push(`s.key_line IS NOT NULL AND s.key_line != ''`)
  }
  const rows = db
    .query(`
      SELECT s.id, s.title, s.category_id, sc.name as category_name,
             s.key_line, s.presentation_count
      FROM songs s
      LEFT JOIN song_categories sc ON s.category_id = sc.id
      WHERE ${conditions.join(' AND ')}
    `)
    .all(...params) as SongDbRow[]
  return new Map(rows.map((r) => [r.id, r]))
}

/**
 * Searches songs via ChromaDB. Hits are per-document (title or slide);
 * results are grouped per song keeping the best-scoring hit, then enriched
 * and filtered from SQLite.
 */
export async function searchSongsChroma(
  query: string,
  mode: ChromaSearchMode,
  categoryIds?: number[],
  rawLimit = 50,
  filters?: SongFilterOptions,
): Promise<SongSearchResult[]> {
  const limit = Math.min(Math.max(1, rawLimit), 200)
  if (!query.trim()) return []
  const startTime = performance.now()

  const where: Where | undefined =
    categoryIds && categoryIds.length > 0
      ? { categoryId: { $in: categoryIds } }
      : undefined

  // Over-fetch: multiple docs may map to the same song and DB-side filters
  // can drop candidates.
  const hits = await runChromaLookup<SongDocMetadata>(
    CHROMA_COLLECTIONS.songs,
    query,
    mode,
    limit * 4,
    where,
  )

  const terms = queryTerms(query)
  interface BestHit {
    score: number
    titleMatch: boolean
    matchedContent: string
  }
  const bestBySong = new Map<number, BestHit>()
  for (const hit of hits) {
    if (!hit.metadata) continue
    const score =
      mode === 'chroma-semantic'
        ? distanceToScore(hit.distance)
        : occurrenceScore(hit.document, terms)
    const isTitle = hit.metadata.kind === 'title'
    const current = bestBySong.get(hit.metadata.songId)
    // Title hits get a small boost, mirroring the FTS path's title bonus.
    const adjusted = isTitle ? score * 1.15 : score
    if (!current || adjusted > current.score) {
      bestBySong.set(hit.metadata.songId, {
        score: adjusted,
        titleMatch: isTitle,
        matchedContent: isTitle ? '' : hit.metadata.original,
      })
    }
  }

  const candidates = [...bestBySong.entries()].sort(
    (a, b) => b[1].score - a[1].score,
  )
  const songRows = fetchFilteredSongs(
    candidates.map(([id]) => id),
    categoryIds,
    filters,
  )

  const results: SongSearchResult[] = []
  for (const [songId, best] of candidates) {
    const row = songRows.get(songId)
    if (!row) continue
    results.push({
      id: row.id,
      title: row.title,
      categoryId: row.category_id,
      categoryName: row.category_name,
      keyLine: row.key_line,
      highlightedTitle: highlightTerms(row.title, terms),
      matchedContent: best.matchedContent
        ? highlightTerms(snippetAround(best.matchedContent, terms), terms)
        : '',
      presentationCount: row.presentation_count,
      score: Math.round(best.score),
    })
    if (results.length >= limit) break
  }

  logger.debug(
    `Chroma ${mode} songs search "${query}": ${results.length} results in ${(performance.now() - startTime).toFixed(1)}ms`,
  )
  return results
}

/** Trims long slide content to a window around the first matching term. */
function snippetAround(text: string, terms: string[], radius = 90): string {
  if (text.length <= radius * 2) return text
  const folded = normalizeForChromaDoc(text)
  let at = -1
  for (const term of terms) {
    at = folded.indexOf(term)
    if (at !== -1) break
  }
  if (at === -1) return `${text.slice(0, radius * 2)}…`
  // folded and original lengths differ slightly; clamp the window
  const start = Math.max(0, Math.min(at, text.length - 1) - radius)
  const end = Math.min(text.length, start + radius * 2)
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}

// ---------------------------------------------------------------------------
// Bible
// ---------------------------------------------------------------------------

/**
 * Searches bible verses via ChromaDB, returning the same shape as the FTS
 * text search (reference parsing stays in the SQLite path).
 */
export async function searchBibleChroma(
  query: string,
  mode: ChromaSearchMode,
  translationId?: number,
  rawLimit = 30,
): Promise<BibleSearchResult[]> {
  const limit = Math.min(Math.max(1, rawLimit), 100)
  if (!query || query.trim().length < 2) return []
  const startTime = performance.now()

  const where: Where | undefined =
    translationId != null
      ? { translationId: { $eq: translationId } }
      : undefined

  const hits = await runChromaLookup<BibleDocMetadata>(
    CHROMA_COLLECTIONS.bible,
    query,
    mode,
    limit,
    where,
  )

  const terms = queryTerms(query)
  const results: BibleSearchResult[] = []
  for (const hit of hits) {
    const m = hit.metadata
    if (!m) continue
    results.push({
      id: m.verseId,
      translationId: m.translationId,
      bookId: m.bookId,
      bookName: m.bookName,
      bookCode: m.bookCode,
      chapter: m.chapter,
      verse: m.verse,
      text: m.original,
      reference: `${m.bookName} ${m.chapter}:${m.verse}`,
      highlightedText: highlightTerms(m.original, terms),
    })
  }

  logger.debug(
    `Chroma ${mode} bible search "${query}": ${results.length} results in ${(performance.now() - startTime).toFixed(1)}ms`,
  )
  return results
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

/**
 * Searches schedules via ChromaDB, same shape as the FTS path.
 */
export async function searchSchedulesChroma(
  query: string,
  mode: ChromaSearchMode,
  rawLimit = 20,
): Promise<ScheduleSearchResult[]> {
  const limit = Math.min(Math.max(1, rawLimit), 100)
  if (!query.trim()) return []

  const hits = await runChromaLookup<ScheduleDocMetadata>(
    CHROMA_COLLECTIONS.schedules,
    query,
    mode,
    limit,
  )

  const terms = queryTerms(query)
  const results: ScheduleSearchResult[] = []
  for (const hit of hits) {
    const m = hit.metadata
    if (!m) continue
    results.push({
      id: m.scheduleId,
      title: m.title,
      description: m.description ?? null,
      itemCount: m.itemCount,
      matchedContent: highlightTerms(m.original, terms),
    })
  }
  return results
}
