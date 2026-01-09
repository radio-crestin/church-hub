export interface AISearchConfig {
  enabled: boolean
  provider: 'openai' | 'anthropic' | 'custom'
  model: string
  apiKey: string
  baseUrl?: string
  analyzeResults?: boolean
}

export type AISearchConfigKey =
  | 'songs_ai_search_config'
  | 'bible_ai_search_config'
