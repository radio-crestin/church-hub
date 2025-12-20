import {
  Book,
  CalendarDays,
  Music,
  Radio,
  Settings,
  SquarePlay,
} from 'lucide-react'

import type {
  BuiltInItemDefinition,
  BuiltInMenuItemId,
  SidebarConfiguration,
} from './types'

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
  version: 1,
  items: [
    {
      id: 'present',
      type: 'builtin',
      builtinId: 'present',
      order: 0,
      isVisible: true,
    },
    {
      id: 'songs',
      type: 'builtin',
      builtinId: 'songs',
      order: 1,
      isVisible: true,
    },
    {
      id: 'bible',
      type: 'builtin',
      builtinId: 'bible',
      order: 2,
      isVisible: true,
    },
    {
      id: 'schedules',
      type: 'builtin',
      builtinId: 'schedules',
      order: 3,
      isVisible: true,
    },
    {
      id: 'livestream',
      type: 'builtin',
      builtinId: 'livestream',
      order: 4,
      isVisible: true,
    },
    // Note: Settings is not configurable - it's fixed at the bottom of the sidebar
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
