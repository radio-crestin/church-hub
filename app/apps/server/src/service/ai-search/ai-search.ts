import { getAISearchConfig, isAISearchEnabled } from './config'
import { generateSearchTerms } from './query-generator'
import type { AISearchInput, AISearchResponse } from './types'
import { searchSongs } from '../songs/search'

/**
 * Perform AI-enhanced semantic search on songs
 *
 * 1. Uses AI to generate relevant search terms from user intent
 * 2. Builds a single efficient FTS query from all terms
 * 3. Executes search using existing FTS infrastructure
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

  // Generate search terms using AI
  const { terms } = await generateSearchTerms(query, config)

  // Combine original query with AI-generated terms
  // The searchSongs function will handle OR logic and deduplication
  const combinedQuery = [query, ...terms].join(' ')

  // Execute search using existing FTS infrastructure
  // This builds an efficient OR query and handles ranking
  const results = searchSongs(combinedQuery, categoryId)

  // Limit to 150 results as per requirement
  const limitedResults = results.slice(0, 150)

  const processingTimeMs = Math.round(performance.now() - startTime)

  return {
    results: limitedResults,
    termsUsed: terms,
    totalCandidates: results.length,
    processingTimeMs,
  }
}
