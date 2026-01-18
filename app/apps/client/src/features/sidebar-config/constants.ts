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
  IconColor,
  SidebarConfiguration,
  SidebarItemSettings,
} from './types'

/**
 * Available icon colors for sidebar items and schedule items
 * These colors match the design system used in AddMenuModal and schedule components
 */
export const ICON_COLORS = [
  'gray',
  'indigo',
  'blue',
  'teal',
  'green',
  'orange',
  'purple',
  'violet',
  'red',
  'pink',
  'yellow',
] as const

/**
 * Default icon colors for built-in sidebar items
 * These match the colors used in AddMenuModal and schedule item components
 */
export const DEFAULT_ICON_COLORS: Record<BuiltInMenuItemId, IconColor> = {
  present: 'violet',
  songs: 'indigo',
  bible: 'blue',
  schedules: 'orange',
  livestream: 'red',
  music: 'purple',
  song_key: 'yellow',
  kiosk: 'gray',
  settings: 'gray',
}

/**
 * Tailwind CSS classes for each icon color
 * Includes background and text colors for light and dark modes
 */
export const ICON_COLOR_CLASSES: Record<
  IconColor,
  { bg: string; text: string }
> = {
  gray: {
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-600 dark:text-gray-400',
  },
  indigo: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    text: 'text-indigo-600 dark:text-indigo-400',
  },
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
  },
  teal: {
    bg: 'bg-teal-100 dark:bg-teal-900/30',
    text: 'text-teal-600 dark:text-teal-400',
  },
  green: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-600 dark:text-green-400',
  },
  orange: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-600 dark:text-orange-400',
  },
  purple: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-600 dark:text-purple-400',
  },
  violet: {
    bg: 'bg-violet-100 dark:bg-violet-900/30',
    text: 'text-violet-600 dark:text-violet-400',
  },
  red: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-600 dark:text-red-400',
  },
  pink: {
    bg: 'bg-pink-100 dark:bg-pink-900/30',
    text: 'text-pink-600 dark:text-pink-400',
  },
  yellow: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-600 dark:text-yellow-400',
  },
}

/**
 * Hex colors for each icon color (darker versions for favicon backgrounds)
 * These are used when the user overrides the favicon color using icon color picker
 */
export const ICON_COLOR_HEX: Record<IconColor, string> = {
  gray: '#4b5563',
  indigo: '#4338ca',
  blue: '#1d4ed8',
  teal: '#0f766e',
  green: '#15803d',
  orange: '#c2410c',
  purple: '#7e22ce',
  violet: '#6d28d9',
  red: '#b91c1c',
  pink: '#be185d',
  yellow: '#a16207',
}

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
    iconColor: builtinId ? DEFAULT_ICON_COLORS[builtinId] : 'gray',
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
