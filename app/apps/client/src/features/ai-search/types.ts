export interface AISearchConfig {
  enabled: boolean
  provider: 'openai' | 'anthropic' | 'gemini' | 'custom'
  model: string
  apiKey: string
  /** Sent instead of `apiKey` to users who may not change settings. */
  apiKeySet?: boolean
  baseUrl?: string
  analyzeResults?: boolean
}

export type AISearchConfigKey =
  | 'songs_ai_search_config'
  | 'bible_ai_search_config'
