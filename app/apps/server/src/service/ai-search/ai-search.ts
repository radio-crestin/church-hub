import { getAISearchConfig, isAISearchEnabled } from './config'
import { generateSearchTerms } from './query-generator'
import { analyzeAndScoreResults } from './result-analyzer'
import type { AISearchInput, AISearchResponse } from './types'
import { searchSongs } from '../songs/search'

/**
 * Perform AI-enhanced semantic search on songs
 *
 * 1. Uses AI to generate relevant search terms from user intent
 * 2. Builds a single efficient FTS query from all terms
 * 3. Executes search using existing FTS infrastructure
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

  // Step 2: Combine original query with AI-generated terms
  // The searchSongs function will handle OR logic and deduplication
  const combinedQuery = [query, ...terms].join(' ')

  // Step 3: Execute search using existing FTS infrastructure
  // This builds an efficient OR query and handles ranking
  // Request 150 candidates for AI analysis
  const ftsResults = searchSongs(combinedQuery, categoryIds, 150)

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
