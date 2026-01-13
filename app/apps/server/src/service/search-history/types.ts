import type { AISearchResult } from '../ai-search/types'

/**
 * Search history item from database
 */
export interface SearchHistoryItem {
  id: number
  query: string
  urlPath: string
  searchType: 'regular' | 'ai'
  categoryIds: number[] | null
  aiResults: AISearchResult[] | null
  resultCount: number | null
  createdAt: number
}

/**
 * Input for saving a search to history
 */
export interface SaveSearchInput {
  query: string
  urlPath: string
  searchType: 'regular' | 'ai'
  categoryIds?: number[] | null
  aiResults?: AISearchResult[] | null
  resultCount?: number | null
}

/**
 * Result of a database operation
 */
export interface OperationResult {
  success: boolean
  error?: string
}
