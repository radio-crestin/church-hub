import type { BibleSearchResult } from '../bible/types'

export interface AIBibleSearchConfig {
  enabled: boolean
  provider: 'openai' | 'anthropic' | 'custom'
  model: string
  apiKey: string
  baseUrl?: string
}

export interface AIBibleSearchInput {
  query: string
  translationId?: number
}

export interface AIGeneratedTerms {
  terms: string[]
}

export interface AIBibleSearchResult extends BibleSearchResult {
  aiRelevanceScore?: number
}

export interface AIBibleSearchResponse {
  results: AIBibleSearchResult[]
  termsUsed: string[]
  totalCandidates: number
  processingTimeMs: number
}
