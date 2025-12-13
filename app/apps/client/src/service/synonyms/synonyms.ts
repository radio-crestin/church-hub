import type { SynonymGroup, SynonymsConfig } from './types'
import { getSetting, upsertSetting } from '../settings/settings'

const SYNONYMS_SETTING_KEY = 'search_synonyms'

/**
 * Gets the saved synonyms configuration from the database
 * Returns empty config if none exists
 */
export async function getSynonymsConfig(): Promise<SynonymsConfig> {
  const setting = await getSetting('app_settings', SYNONYMS_SETTING_KEY)

  if (!setting) {
    return { groups: [] }
  }

  try {
    const parsed = JSON.parse(setting.value) as SynonymsConfig
    return parsed
  } catch {
    return { groups: [] }
  }
}

/**
 * Saves the synonyms configuration to the database
 */
export async function saveSynonymsConfig(
  config: SynonymsConfig,
): Promise<boolean> {
  return await upsertSetting('app_settings', {
    key: SYNONYMS_SETTING_KEY,
    value: JSON.stringify(config),
  })
}

/**
 * Adds a new synonym group
 */
export async function addSynonymGroup(
  group: Omit<SynonymGroup, 'id'>,
): Promise<boolean> {
  const config = await getSynonymsConfig()
  const newGroup: SynonymGroup = {
    ...group,
    id: crypto.randomUUID(),
  }
  config.groups.push(newGroup)
  return await saveSynonymsConfig(config)
}

/**
 * Updates an existing synonym group
 */
export async function updateSynonymGroup(
  group: SynonymGroup,
): Promise<boolean> {
  const config = await getSynonymsConfig()
  const index = config.groups.findIndex((g) => g.id === group.id)

  if (index === -1) {
    return false
  }

  config.groups[index] = group
  return await saveSynonymsConfig(config)
}

/**
 * Deletes a synonym group
 */
export async function deleteSynonymGroup(id: string): Promise<boolean> {
  const config = await getSynonymsConfig()
  config.groups = config.groups.filter((g) => g.id !== id)
  return await saveSynonymsConfig(config)
}
