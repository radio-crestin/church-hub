import type { AIBibleSearchConfig } from './types'
import { getSetting } from '../settings/settings'

// Reuse the same config key as songs AI search
const AI_SEARCH_CONFIG_KEY = 'ai_search_config'

/**
 * Load AI search configuration from app_settings
 * Reuses the same config as songs AI search
 */
export function getAIBibleSearchConfig(): AIBibleSearchConfig | null {
  const setting = getSetting('app_settings', AI_SEARCH_CONFIG_KEY)
  if (!setting?.value) return null

  try {
    return JSON.parse(setting.value) as AIBibleSearchConfig
  } catch {
    return null
  }
}

/**
 * Check if AI search is enabled and properly configured
 */
export function isAIBibleSearchEnabled(): boolean {
  const config = getAIBibleSearchConfig()
  return config?.enabled === true && !!config?.apiKey
}
