import { getAISearchConfig, isAISearchEnabled } from './config'
import { generateSearchTerms } from './query-generator'
import { analyzeAndScoreResults } from './result-analyzer'
import type { AISearchInput, AISearchResponse } from './types'
import { searchSongs } from '../songs/song-search/searchSongs'

/**
 * Perform AI-enhanced semantic search on songs
 *
 * 1. Uses AI to generate relevant search terms from user intent
 * 2. Searches the query and each term with the shared song search
 * 3. Merges the songs found, up to 150 candidates
 * 4. Uses AI to analyze and score results based on content relevance
 * 5. Returns top 100 results sorted by AI relevance score
 */
export async function aiSearchSongs(
  input: AISearchInput,
): Promise<AISearchResponse> {
  const startTime = performance.now()

  if (!isAISearchEnabled()) {
    throw new Error('AI search is not configured')
  }

  const config = getAISearchConfig()
  if (!config) {
    throw new Error('AI search configuration not found')
  }

  const { query, categoryIds } = input

  // Step 1: Generate search terms using AI
  const { terms } = await generateSearchTerms(query, config)

  // Step 2-3: Search the original query, then each AI term on its own (a
  // song needs every word of a query, so the terms cannot be run as one),
  // merging up to 150 candidates for AI analysis.
  const ftsResults = searchEachQuery([query, ...terms], categoryIds)

  // Step 4: Optionally use AI to analyze content and score relevance
  // Skip if analyzeResults is false (default) - only query expansion is used
  let finalResults: typeof ftsResults
  if (config.analyzeResults) {
    // Use AI to score results - filters to top 100 sorted by AI score
    finalResults = await analyzeAndScoreResults(query, ftsResults, config)
  } else {
    // Skip AI analysis - return FTS results directly (faster)
    finalResults = ftsResults.slice(0, 100)
  }

  const processingTimeMs = Math.round(performance.now() - startTime)

  return {
    results: finalResults,
    termsUsed: terms,
    totalCandidates: ftsResults.length,
    processingTimeMs,
  }
}

const MAX_CANDIDATES = 150

/** Every query searched in turn, the songs merged in order of first find. */
function searchEachQuery(
  queries: string[],
  categoryIds: number[] | undefined,
): ReturnType<typeof searchSongs> {
  const found = new Map<number, ReturnType<typeof searchSongs>[number]>()
  for (const query of queries) {
    if (found.size >= MAX_CANDIDATES) break
    for (const song of searchSongs(query, categoryIds, MAX_CANDIDATES)) {
      if (!found.has(song.id)) found.set(song.id, song)
    }
  }
  return Array.from(found.values()).slice(0, MAX_CANDIDATES)
}
