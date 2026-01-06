import type { SongSearchResult } from '../songs/types'

/**
 * AI search configuration stored in app_settings
 */
export interface AISearchConfig {
  enabled: boolean
  provider: 'openai' | 'anthropic' | 'custom'
  model: string
  apiKey: string
  baseUrl?: string
  /** Enable AI analysis of results for semantic scoring (slower but more accurate) */
  analyzeResults?: boolean
}

/**
 * Input for AI search request
 */
export interface AISearchInput {
  query: string
  categoryId?: number
}

/**
 * Generated search terms from AI
 */
export interface AIGeneratedTerms {
  terms: string[]
}

/**
 * AI search result extends regular search result with AI metadata
 */
export interface AISearchResult extends SongSearchResult {
  aiRelevanceScore?: number
}

/**
 * AI search response
 */
export interface AISearchResponse {
  results: AISearchResult[]
  termsUsed: string[]
  totalCandidates: number
  processingTimeMs: number
}
