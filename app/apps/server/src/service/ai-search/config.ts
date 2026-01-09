import type { AISearchConfig } from './types'
import { getSetting } from '../settings/settings'

const SONGS_AI_SEARCH_CONFIG_KEY = 'songs_ai_search_config'

/**
 * Load AI search configuration from app_settings
 */
export function getAISearchConfig(): AISearchConfig | null {
  const setting = getSetting('app_settings', SONGS_AI_SEARCH_CONFIG_KEY)
  if (!setting?.value) return null

  try {
    return JSON.parse(setting.value) as AISearchConfig
  } catch {
    return null
  }
}

/**
 * Check if AI search is enabled and properly configured
 */
export function isAISearchEnabled(): boolean {
  const config = getAISearchConfig()
  return config?.enabled === true && !!config?.apiKey
}
