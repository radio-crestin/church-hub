import {
  Book,
  CalendarDays,
  Headphones,
  KeyRound,
  Monitor,
  Music,
  Radio,
  Settings,
  SquarePlay,
} from 'lucide-react'

import type {
  BuiltInItemDefinition,
  BuiltInMenuItemId,
  SidebarConfiguration,
  SidebarItemSettings,
} from './types'

/**
 * Which built-in pages have search functionality
 */
export const PAGES_WITH_SEARCH: Record<BuiltInMenuItemId, boolean> = {
  songs: true,
  bible: true,
  music: true,
  schedules: true,
  present: false,
  livestream: false,
  song_key: false,
  kiosk: false,
  settings: false,
}

/**
 * Default focus search behavior for pages with search
 * - Songs, Bible, Music: enabled by default
 * - Schedules: disabled by default (user can enable)
 */
export const DEFAULT_FOCUS_SEARCH: Record<BuiltInMenuItemId, boolean> = {
  songs: true,
  bible: true,
  music: true,
  schedules: false,
  present: false,
  livestream: false,
  song_key: false,
  kiosk: false,
  settings: false,
}

/**
 * Get default settings for a sidebar item
 */
export function getDefaultSidebarItemSettings(
  builtinId?: BuiltInMenuItemId,
): SidebarItemSettings {
  return {
    shortcuts: [],
    focusSearchOnNavigate: builtinId ? DEFAULT_FOCUS_SEARCH[builtinId] : false,
    nativeWindow: {
      openInNativeWindow: false,
      autoOpenOnStartup: false,
      forceNativeWindow: false,
    },
  }
}

/**
 * Static definitions of built-in sidebar items
 */
export const BUILTIN_ITEMS: Record<BuiltInMenuItemId, BuiltInItemDefinition> = {
  present: {
    id: 'present',
    icon: SquarePlay,
    labelKey: 'sidebar:navigation.present',
    to: '/present',
    permission: 'control_room.view',
  },
  songs: {
    id: 'songs',
    icon: Music,
    labelKey: 'sidebar:navigation.songs',
    to: '/songs',
    permission: 'songs.view',
  },
  bible: {
    id: 'bible',
    icon: Book,
    labelKey: 'sidebar:navigation.bible',
    to: '/bible',
    permission: 'bible.view',
  },
  schedules: {
    id: 'schedules',
    icon: CalendarDays,
    labelKey: 'sidebar:navigation.schedules',
    to: '/schedules',
    permission: 'programs.view',
  },
  livestream: {
    id: 'livestream',
    icon: Radio,
    labelKey: 'sidebar:navigation.livestream',
    to: '/livestream',
    permission: 'settings.view',
  },
  music: {
    id: 'music',
    icon: Headphones,
    labelKey: 'sidebar:navigation.music',
    to: '/music',
    permission: 'settings.view',
  },
  song_key: {
    id: 'song_key',
    icon: KeyRound,
    labelKey: 'sidebar:navigation.songKey',
    to: '/song-key',
    permission: 'song_key.view',
  },
  kiosk: {
    id: 'kiosk',
    icon: Monitor,
    labelKey: 'sidebar:navigation.kiosk',
    to: '/kiosk', // Special marker - actual navigation handled by sidebar
    permission: 'settings.view',
  },
  settings: {
    id: 'settings',
    icon: Settings,
    labelKey: 'sidebar:navigation.settings',
    to: '/settings',
    permission: 'settings.view',
  },
}

/**
 * Default sidebar configuration used when no configuration exists
 */
export const DEFAULT_SIDEBAR_CONFIG: SidebarConfiguration = {
  version: 2,
  items: [
    {
      id: 'present',
      type: 'builtin',
      builtinId: 'present',
      order: 0,
      isVisible: true,
      settings: getDefaultSidebarItemSettings('present'),
    },
    {
      id: 'songs',
      type: 'builtin',
      builtinId: 'songs',
      order: 1,
      isVisible: true,
      settings: getDefaultSidebarItemSettings('songs'),
    },
    {
      id: 'bible',
      type: 'builtin',
      builtinId: 'bible',
      order: 2,
      isVisible: true,
      settings: getDefaultSidebarItemSettings('bible'),
    },
    {
      id: 'schedules',
      type: 'builtin',
      builtinId: 'schedules',
      order: 3,
      isVisible: true,
      settings: getDefaultSidebarItemSettings('schedules'),
    },
    {
      id: 'livestream',
      type: 'builtin',
      builtinId: 'livestream',
      order: 4,
      isVisible: true,
      settings: getDefaultSidebarItemSettings('livestream'),
    },
    {
      id: 'music',
      type: 'builtin',
      builtinId: 'music',
      order: 5,
      isVisible: true,
      settings: getDefaultSidebarItemSettings('music'),
    },
    {
      id: 'song_key',
      type: 'builtin',
      builtinId: 'song_key',
      order: 6,
      isVisible: true,
      settings: getDefaultSidebarItemSettings('song_key'),
    },
    // Note: Settings is not configurable - it's fixed at the bottom of the sidebar
    // Note: Kiosk is not configurable - it's dynamically shown when kiosk mode is enabled
  ],
}

/**
 * Curated subset of Lucide icons available for custom pages
 */
export const AVAILABLE_ICONS = [
  'Globe',
  'Link',
  'ExternalLink',
  'FileText',
  'Video',
  'Image',
  'Bookmark',
  'Star',
  'Heart',
  'Home',
  'Users',
  'Calendar',
  'MessageSquare',
  'Phone',
  'Mail',
  'Map',
  'Compass',
  'Search',
  'Clock',
  'Bell',
  'Layers',
  'Grid',
  'List',
  'Folder',
] as const

export type AvailableIconName = (typeof AVAILABLE_ICONS)[number]

/**
 * Settings key for sidebar configuration
 */
export const SIDEBAR_CONFIG_KEY = 'sidebar_configuration'
