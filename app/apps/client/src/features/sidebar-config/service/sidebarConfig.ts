import { getSetting, upsertSetting } from '~/service/settings/settings'
import type { CustomPagePermission } from '../../users/types'
import {
  BUILTIN_ITEMS,
  DEFAULT_SIDEBAR_CONFIG,
  getDefaultSidebarItemSettings,
  SIDEBAR_CONFIG_KEY,
} from '../constants'
import type {
  BuiltInMenuItemId,
  SidebarConfiguration,
  SidebarMenuItem,
} from '../types'

/**
 * Merges stored configuration with defaults to handle new built-in items
 * that may have been added to the app since the config was saved
 */
// Items that are not configurable in the sidebar config manager
const NON_CONFIGURABLE_ITEMS: BuiltInMenuItemId[] = ['settings', 'kiosk']

function mergeWithDefaults(stored: SidebarConfiguration): SidebarConfiguration {
  const defaultBuiltinIds = Object.keys(BUILTIN_ITEMS) as BuiltInMenuItemId[]
  const storedIds = new Set(stored.items.map((item) => item.id))

  // Find new built-in items not in stored config (excluding non-configurable items)
  const newItems: SidebarMenuItem[] = defaultBuiltinIds
    .filter((id) => !storedIds.has(id) && !NON_CONFIGURABLE_ITEMS.includes(id))
    .map((id, index) => ({
      id,
      type: 'builtin' as const,
      builtinId: id,
      order: stored.items.length + index,
      isVisible: true,
      settings: getDefaultSidebarItemSettings(id),
    }))

  if (newItems.length === 0) {
    return stored
  }

  return {
    ...stored,
    items: [...stored.items, ...newItems],
  }
}

/**
 * Validates that a parsed configuration has the expected structure
 */
function isValidConfiguration(obj: unknown): obj is SidebarConfiguration {
  if (typeof obj !== 'object' || obj === null) {
    return false
  }

  const config = obj as Record<string, unknown>
  // Accept version 1 or 2
  if (
    (config.version !== 1 && config.version !== 2) ||
    !Array.isArray(config.items)
  ) {
    return false
  }

  return true
}

/**
 * Migrates configuration from v1 to v2
 * Adds default settings to all items that don't have them
 */
function migrateToV2(config: SidebarConfiguration): SidebarConfiguration {
  if (config.version === 2) {
    return config
  }

  return {
    version: 2,
    items: config.items.map((item) => {
      if (item.settings) {
        return item
      }

      // Get the builtin ID for default settings lookup
      const builtinId = item.type === 'builtin' ? item.builtinId : undefined

      return {
        ...item,
        settings: getDefaultSidebarItemSettings(builtinId),
      }
    }),
  }
}

/**
 * Gets the sidebar configuration from settings
 * Returns default configuration if none exists or if parsing fails
 * Automatically migrates older versions to the current version
 */
export async function getSidebarConfiguration(): Promise<SidebarConfiguration> {
  const setting = await getSetting('app_settings', SIDEBAR_CONFIG_KEY)

  if (!setting) {
    return DEFAULT_SIDEBAR_CONFIG
  }

  try {
    const parsed = JSON.parse(setting.value)

    if (!isValidConfiguration(parsed)) {
      return DEFAULT_SIDEBAR_CONFIG
    }

    // Migrate to latest version if needed
    const migrated = migrateToV2(parsed)

    // Merge with defaults to handle new built-in items
    return mergeWithDefaults(migrated)
  } catch {
    return DEFAULT_SIDEBAR_CONFIG
  }
}

/**
 * Saves the sidebar configuration to settings
 */
export async function saveSidebarConfiguration(
  config: SidebarConfiguration,
): Promise<boolean> {
  return upsertSetting('app_settings', {
    key: SIDEBAR_CONFIG_KEY,
    value: JSON.stringify(config),
  })
}

/**
 * Generates a unique ID for a new custom page
 */
export function generateCustomPageId(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Gets the permission key for a custom page
 */
export function getCustomPagePermission(pageId: string): CustomPagePermission {
  return `custom_page.${pageId}.view`
}
