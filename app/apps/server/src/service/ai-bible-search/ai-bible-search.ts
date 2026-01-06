import { getAIBibleSearchConfig, isAIBibleSearchEnabled } from './config'
import { generateBibleSearchTerms } from './query-generator'
import { analyzeBibleResults } from './result-analyzer'
import type { AIBibleSearchInput, AIBibleSearchResponse } from './types'
import { searchVersesByText } from '../bible/search'

/**
 * Perform AI-enhanced semantic search on Bible verses
 *
 * 1. Uses AI to generate relevant search terms from user intent
 * 2. Executes search using existing FTS infrastructure with expanded terms
 * 3. Uses AI to analyze and score results based on content relevance
 * 4. Returns top 100 results sorted by AI relevance score
 */
export async function aiBibleSearch(
  input: AIBibleSearchInput,
): Promise<AIBibleSearchResponse> {
  const startTime = performance.now()

  if (!isAIBibleSearchEnabled()) {
    throw new Error('AI search is not configured')
  }

  const config = getAIBibleSearchConfig()
  if (!config) {
    throw new Error('AI search configuration not found')
  }

  const { query, translationId } = input

  // Step 1: Generate search terms using AI
  const { terms } = await generateBibleSearchTerms(query, config)

  // Step 2: Search with each term and combine results
  // Bible FTS doesn't handle OR queries as well, so we search each term separately
  const allResults = new Map<number, (typeof ftsResults)[0]>()

  // Search with original query first
  const originalResults = searchVersesByText({
    query,
    translationId,
    limit: 50,
  })
  for (const result of originalResults) {
    allResults.set(result.id, result)
  }

  // Search with AI-generated terms
  for (const term of terms) {
    if (allResults.size >= 150) break // Cap at 150 candidates

    const termResults = searchVersesByText({
      query: term,
      translationId,
      limit: 30,
    })

    for (const result of termResults) {
      if (!allResults.has(result.id)) {
        allResults.set(result.id, result)
      }
      if (allResults.size >= 150) break
    }
  }

  const ftsResults = Array.from(allResults.values())

  // Step 3: Optionally use AI to analyze content and score relevance
  // Skip if analyzeResults is false (default) - only query expansion is used
  let finalResults: typeof ftsResults
  if (config.analyzeResults) {
    // Use AI to score results - filters to top 100 sorted by AI score
    finalResults = await analyzeBibleResults(query, ftsResults, config)
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
