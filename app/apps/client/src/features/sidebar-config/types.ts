import type { LucideIcon } from 'lucide-react'

import type { Permission } from '../users/types'

/**
 * Identifier for built-in menu items
 */
export type BuiltInMenuItemId =
  | 'present'
  | 'songs'
  | 'bible'
  | 'schedules'
  | 'livestream'
  | 'music'
  | 'kiosk'
  | 'settings'

/**
 * Settings for a sidebar item (shortcuts, navigation behavior)
 */
export interface SidebarItemSettings {
  /** Keyboard/MIDI shortcuts that navigate to this page */
  shortcuts: string[]
  /** Whether to focus the search input when navigating via shortcut */
  focusSearchOnNavigate: boolean
}

/**
 * Base properties shared by all menu items
 */
interface BaseMenuItem {
  id: string
  order: number
  isVisible: boolean
  /** Optional settings for shortcuts and navigation behavior */
  settings?: SidebarItemSettings
}

/**
 * Built-in menu item that references a static definition
 */
export interface BuiltInMenuItem extends BaseMenuItem {
  type: 'builtin'
  builtinId: BuiltInMenuItemId
}

/**
 * Custom page menu item with embedded URL
 */
export interface CustomPageMenuItem extends BaseMenuItem {
  type: 'custom'
  title: string
  url: string
  iconName: string
  /** Use iframe embedding instead of native webview (default: false) */
  useIframeEmbedding?: boolean
}

/**
 * Union type for all sidebar menu items
 */
export type SidebarMenuItem = BuiltInMenuItem | CustomPageMenuItem

/**
 * Full sidebar configuration stored in settings
 * Version history:
 * - v1: Initial version with basic sidebar items
 * - v2: Added settings (shortcuts, focusSearchOnNavigate) to items
 */
export interface SidebarConfiguration {
  version: 1 | 2
  items: SidebarMenuItem[]
}

/**
 * Static definition of a built-in item (not stored, used for rendering)
 */
export interface BuiltInItemDefinition {
  id: BuiltInMenuItemId
  icon: LucideIcon
  labelKey: string
  to: string
  permission: Permission
}

/**
 * Input for creating or editing a custom page
 */
export interface CustomPageInput {
  id?: string
  title: string
  url: string
  iconName: string
  useIframeEmbedding?: boolean
}

/**
 * Resolved menu item ready for rendering in the sidebar
 */
export interface ResolvedMenuItem {
  id: string
  icon: LucideIcon
  label: string
  to: string
  permission: Permission | null
  isCustom: boolean
}
