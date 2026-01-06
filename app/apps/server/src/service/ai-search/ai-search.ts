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

  const { query, categoryId } = input

  // Step 1: Generate search terms using AI
  const { terms } = await generateSearchTerms(query, config)

  // Step 2: Combine original query with AI-generated terms
  // The searchSongs function will handle OR logic and deduplication
  const combinedQuery = [query, ...terms].join(' ')

  // Step 3: Execute search using existing FTS infrastructure
  // This builds an efficient OR query and handles ranking
  const ftsResults = searchSongs(combinedQuery, categoryId)

  // Step 4: Take top 150 candidates for AI analysis
  const candidates = ftsResults.slice(0, 150)

  // Step 5: Use AI to analyze content and score relevance
  // This filters to top 100 results sorted by AI score
  const scoredResults = await analyzeAndScoreResults(query, candidates, config)

  const processingTimeMs = Math.round(performance.now() - startTime)

  return {
    results: scoredResults,
    termsUsed: terms,
    totalCandidates: ftsResults.length,
    processingTimeMs,
  }
}
