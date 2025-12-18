import { getSetting, upsertSetting } from '~/service/settings/settings'

import type { CustomPagePermission } from '../../users/types'
import {
  BUILTIN_ITEMS,
  DEFAULT_SIDEBAR_CONFIG,
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
function mergeWithDefaults(
  stored: SidebarConfiguration,
): SidebarConfiguration {
  const defaultBuiltinIds = Object.keys(BUILTIN_ITEMS) as BuiltInMenuItemId[]
  const storedIds = new Set(stored.items.map((item) => item.id))

  // Find new built-in items not in stored config
  const newItems: SidebarMenuItem[] = defaultBuiltinIds
    .filter((id) => !storedIds.has(id))
    .map((id, index) => ({
      id,
      type: 'builtin' as const,
      builtinId: id,
      order: stored.items.length + index,
      isVisible: true,
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
  if (config.version !== 1 || !Array.isArray(config.items)) {
    return false
  }

  return true
}

/**
 * Gets the sidebar configuration from settings
 * Returns default configuration if none exists or if parsing fails
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

    return mergeWithDefaults(parsed)
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
