import { createLogger } from '../../../utils/logger'
import { getSetting } from '../../settings'
import { foldSearchText } from '../../text-search/foldSearchText'

const logger = createLogger('song-search:synonyms')

/** A synonym group as the settings page saves it. */
interface SynonymGroup {
  id: string
  primary: string
  synonyms: string[]
}

interface SynonymsConfig {
  groups: SynonymGroup[]
}

const CACHE_TTL_MS = 60_000
let cached: { map: Map<string, string[]>; loadedAt: number } | null = null

/**
 * The words the operator set up as meaning the same (Settings → synonyms):
 * "cristos" → ["hristos"]. Read from the settings at most once a minute.
 */
export function songSynonymsOf(word: string): string[] {
  return synonymMap().get(foldSearchText(word)) ?? []
}

function synonymMap(): Map<string, string[]> {
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) return cached.map
  cached = { map: loadSynonymMap(), loadedAt: Date.now() }
  return cached.map
}

/**
 * Each word of a group, folded the way search terms are ("cântare" is
 * looked up as "cantare"), mapped to every other word of its group.
 */
function loadSynonymMap(): Map<string, string[]> {
  const map = new Map<string, string[]>()
  const setting = getSetting('app_settings', 'search_synonyms')
  if (!setting) return map
  try {
    const config = JSON.parse(setting.value) as SynonymsConfig
    for (const group of config.groups) {
      const words = [group.primary, ...group.synonyms]
        .map((word) => foldSearchText(word).trim())
        .filter((word) => word.length > 0)
      for (const word of words) {
        const others = words.filter((other) => other !== word)
        map.set(word, [...new Set([...(map.get(word) ?? []), ...others])])
      }
    }
  } catch (error) {
    logger.error(`Failed to parse synonyms config: ${error}`)
  }
  return map
}
