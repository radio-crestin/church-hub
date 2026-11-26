import {
  Book,
  CalendarDays,
  Globe,
  Headphones,
  Images,
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
  gallery: 'teal',
  livestream: 'red',
  music: 'purple',
  song_key: 'yellow',
  live_translation: 'blue',
  kiosk: 'gray',
  settings: 'gray',
}

/**
 * Tailwind CSS classes for each icon color
 * Includes background and text colors for light and dark modes
 */
/** DESIGN.md bans coloured icon tiles: every icon colour renders as the
 * same neutral line icon, so the UI stays monochrome. */
const NEUTRAL_ICON = { bg: 'bg-transparent', text: 'text-fg-label' }

export const ICON_COLOR_CLASSES: Record<
  IconColor,
  { bg: string; text: string }
> = {
  gray: NEUTRAL_ICON,
  indigo: NEUTRAL_ICON,
  blue: NEUTRAL_ICON,
  teal: NEUTRAL_ICON,
  green: NEUTRAL_ICON,
  orange: NEUTRAL_ICON,
  purple: NEUTRAL_ICON,
  violet: NEUTRAL_ICON,
  red: NEUTRAL_ICON,
  pink: NEUTRAL_ICON,
  yellow: NEUTRAL_ICON,
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
  gallery: false,
  livestream: false,
  song_key: false,
  live_translation: false,
  kiosk: false,
  settings: false,
}

/**
 * Built-in pages that act on their own presentation keys (show the selected
 * slide or verse, next, previous) while they are open
 */
export const PAGES_WITH_SLIDE_KEYS: BuiltInMenuItemId[] = ['songs', 'bible']

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
  gallery: false,
  livestream: false,
  song_key: false,
  live_translation: false,
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
  gallery: {
    id: 'gallery',
    icon: Images,
    labelKey: 'sidebar:navigation.gallery',
    to: '/gallery',
    permission: 'displays.view',
  },
  livestream: {
    id: 'livestream',
    icon: Radio,
    labelKey: 'sidebar:navigation.livestream',
    to: '/livestream',
    permission: 'settings.view',
    pcOnly: true,
  },
  music: {
    id: 'music',
    icon: Headphones,
    labelKey: 'sidebar:navigation.music',
    to: '/music',
    permission: 'settings.view',
    pcOnly: true,
  },
  song_key: {
    id: 'song_key',
    icon: KeyRound,
    labelKey: 'sidebar:navigation.songKey',
    to: '/song-key',
    permission: 'song_key.view',
  },
  live_translation: {
    id: 'live_translation',
    icon: Globe,
    labelKey: 'sidebar:navigation.liveTranslation',
    to: '/live-translation',
    permission: 'settings.view',
    pcOnly: true,
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
      id: 'gallery',
      type: 'builtin',
      builtinId: 'gallery',
      order: 4,
      isVisible: true,
      settings: getDefaultSidebarItemSettings('gallery'),
    },
    {
      id: 'livestream',
      type: 'builtin',
      builtinId: 'livestream',
      order: 5,
      isVisible: true,
      settings: getDefaultSidebarItemSettings('livestream'),
    },
    {
      id: 'music',
      type: 'builtin',
      builtinId: 'music',
      order: 6,
      isVisible: true,
      settings: getDefaultSidebarItemSettings('music'),
    },
    {
      id: 'song_key',
      type: 'builtin',
      builtinId: 'song_key',
      order: 7,
      isVisible: true,
      settings: getDefaultSidebarItemSettings('song_key'),
    },
    {
      id: 'live_translation',
      type: 'builtin',
      builtinId: 'live_translation',
      order: 8,
      isVisible: true,
      settings: getDefaultSidebarItemSettings('live_translation'),
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
