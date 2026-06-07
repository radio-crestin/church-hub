import { isChromaReady } from './status'
import type { SearchEngine } from './types'
import { SEARCH_ENGINE_SETTING_KEY, SEARCH_ENGINES } from './types'
import { getSetting, upsertSetting } from '../settings'

function isSearchEngine(value: string): value is SearchEngine {
  return (SEARCH_ENGINES as string[]).includes(value)
}

/**
 * Returns the configured search engine.
 * Resolution order: SEARCH_ENGINE env override → app_settings → 'sqlite'.
 */
export function getSearchEngine(): SearchEngine {
  const envOverride = process.env.SEARCH_ENGINE
  if (envOverride && isSearchEngine(envOverride)) {
    return envOverride
  }
  const setting = getSetting('app_settings', SEARCH_ENGINE_SETTING_KEY)
  if (setting?.value && isSearchEngine(setting.value)) {
    return setting.value
  }
  return 'sqlite'
}

/**
 * The engine actually used for a request right now: a Chroma engine that
 * isn't ready yet (still starting/syncing initial data unavailable/error)
 * falls back to SQLite so search never breaks.
 */
export function getEffectiveSearchEngine(): {
  configured: SearchEngine
  effective: SearchEngine
  fallback: boolean
} {
  const configured = getSearchEngine()
  if (configured !== 'sqlite' && !isChromaReady()) {
    return { configured, effective: 'sqlite', fallback: true }
  }
  return { configured, effective: configured, fallback: false }
}

/** Persists the search engine selection. */
export function setSearchEngine(engine: string): SearchEngine {
  if (!isSearchEngine(engine)) {
    throw new Error(
      `Invalid search engine: ${engine}. Valid: ${SEARCH_ENGINES.join(', ')}`,
    )
  }
  upsertSetting('app_settings', {
    key: SEARCH_ENGINE_SETTING_KEY,
    value: engine,
  })
  return engine
}
