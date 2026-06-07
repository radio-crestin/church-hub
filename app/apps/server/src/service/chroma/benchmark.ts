import { searchBibleChroma, searchSongsChroma } from './search'
import { isChromaReady } from './status'
import type { SearchEngine } from './types'
import { clearBibleSearchCache, searchVersesByText } from '../bible/search'
import { clearSearchCache, searchSongs } from '../songs/search'

const DEFAULT_SONG_QUERIES = [
  'În străvechea Carte sfânt',
  'in stravechea carte sfant',
  'Isus',
  'Doamne',
  'har',
  'credinta',
  'slavă Domnului',
]

const DEFAULT_BIBLE_QUERIES = [
  'dragostea lui Dumnezeu',
  'la inceput era cuvantul',
  'pastorul meu',
  'credinta nadejdea',
]

interface QueryStats {
  query: string
  avgMs: number
  minMs: number
  maxMs: number
  resultCount: number
  topResult: string | null
  /** share of this engine's top-10 ids also in sqlite's top-10 (0..1) */
  overlapWithSqlite: number | null
}

interface EngineReport {
  engine: SearchEngine
  available: boolean
  queries: QueryStats[]
  totalAvgMs: number
}

export interface BenchmarkReport {
  domain: 'songs' | 'bible'
  iterations: number
  engines: EngineReport[]
}

interface RunResult {
  ids: number[]
  top: string | null
}

async function timeQueries(
  queries: string[],
  iterations: number,
  run: (query: string) => Promise<RunResult>,
  clearCaches: () => void,
  sqliteTopIds?: Map<string, number[]>,
): Promise<{ stats: QueryStats[]; totalAvgMs: number }> {
  const stats: QueryStats[] = []
  let totalAvg = 0
  for (const query of queries) {
    const times: number[] = []
    let last: RunResult = { ids: [], top: null }
    for (let i = 0; i < iterations; i++) {
      clearCaches()
      const start = performance.now()
      last = await run(query)
      times.push(performance.now() - start)
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length
    totalAvg += avg

    let overlap: number | null = null
    const baseline = sqliteTopIds?.get(query)
    if (baseline) {
      const base = new Set(baseline.slice(0, 10))
      const mine = last.ids.slice(0, 10)
      overlap =
        base.size > 0
          ? mine.filter((id) => base.has(id)).length / Math.min(10, base.size)
          : null
    }

    stats.push({
      query,
      avgMs: Math.round(avg * 100) / 100,
      minMs: Math.round(Math.min(...times) * 100) / 100,
      maxMs: Math.round(Math.max(...times) * 100) / 100,
      resultCount: last.ids.length,
      topResult: last.top,
      overlapWithSqlite:
        overlap == null ? null : Math.round(overlap * 100) / 100,
    })
  }
  return {
    stats,
    totalAvgMs: Math.round((totalAvg / queries.length) * 100) / 100,
  }
}

/**
 * Benchmarks the same queries through SQLite FTS5 and both Chroma modes,
 * reporting per-query timings and top-10 result overlap vs the SQLite
 * baseline. Caches are cleared between runs so timings measure engines.
 */
export async function runSearchBenchmark(options?: {
  domain?: 'songs' | 'bible'
  queries?: string[]
  iterations?: number
}): Promise<BenchmarkReport> {
  const domain = options?.domain ?? 'songs'
  const iterations = Math.min(Math.max(1, options?.iterations ?? 5), 20)
  const queries =
    options?.queries && options.queries.length > 0
      ? options.queries.slice(0, 20)
      : domain === 'songs'
        ? DEFAULT_SONG_QUERIES
        : DEFAULT_BIBLE_QUERIES

  const runners: Record<
    'songs' | 'bible',
    Record<SearchEngine, (q: string) => Promise<RunResult>>
  > = {
    songs: {
      sqlite: async (q) => {
        const res = searchSongs(q)
        return { ids: res.map((r) => r.id), top: res[0]?.title ?? null }
      },
      'chroma-keyword': async (q) => {
        const res = await searchSongsChroma(q, 'chroma-keyword')
        return { ids: res.map((r) => r.id), top: res[0]?.title ?? null }
      },
      'chroma-semantic': async (q) => {
        const res = await searchSongsChroma(q, 'chroma-semantic')
        return { ids: res.map((r) => r.id), top: res[0]?.title ?? null }
      },
    },
    bible: {
      sqlite: async (q) => {
        const res = searchVersesByText({ query: q })
        return { ids: res.map((r) => r.id), top: res[0]?.reference ?? null }
      },
      'chroma-keyword': async (q) => {
        const res = await searchBibleChroma(q, 'chroma-keyword')
        return { ids: res.map((r) => r.id), top: res[0]?.reference ?? null }
      },
      'chroma-semantic': async (q) => {
        const res = await searchBibleChroma(q, 'chroma-semantic')
        return { ids: res.map((r) => r.id), top: res[0]?.reference ?? null }
      },
    },
  }

  const clearCaches =
    domain === 'songs' ? clearSearchCache : clearBibleSearchCache

  const engines: EngineReport[] = []

  // SQLite baseline first — its top ids feed the overlap metric.
  const sqliteTopIds = new Map<string, number[]>()
  const sqliteRun = await timeQueries(
    queries,
    iterations,
    async (q) => {
      const result = await runners[domain].sqlite(q)
      sqliteTopIds.set(q, result.ids)
      return result
    },
    clearCaches,
  )
  engines.push({
    engine: 'sqlite',
    available: true,
    queries: sqliteRun.stats,
    totalAvgMs: sqliteRun.totalAvgMs,
  })

  for (const engine of ['chroma-keyword', 'chroma-semantic'] as const) {
    if (!isChromaReady()) {
      engines.push({ engine, available: false, queries: [], totalAvgMs: 0 })
      continue
    }
    const run = await timeQueries(
      queries,
      iterations,
      runners[domain][engine],
      clearCaches,
      sqliteTopIds,
    )
    engines.push({
      engine,
      available: true,
      queries: run.stats,
      totalAvgMs: run.totalAvgMs,
    })
  }

  return { domain, iterations, engines }
}
