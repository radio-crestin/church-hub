import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  Info,
  Keyboard,
  Monitor,
  Music,
  Palette,
  PanelLeft,
  Radio,
  Sliders,
  Tv,
  User,
  Users,
  Wifi,
  Wrench,
} from 'lucide-react'

import type { Permission } from '~/features/users/types'

/**
 * Runtime context fed to each item's visibility predicate so the sidebar,
 * the index redirect, and per-route guards all share one source of truth.
 */
export interface SettingsVisibilityContext {
  hasPermission: (permission: Permission) => boolean
  isMobile: boolean
  isLocalhost: boolean
}

export interface SettingsNavItemDef {
  id: string
  /** i18n key in the `settings` namespace. */
  labelKey: string
  icon: LucideIcon
  /** TanStack `to` — must match a leaf route file path exactly. */
  to: string
  /** Defaults to always-visible when omitted. */
  visible?: (ctx: SettingsVisibilityContext) => boolean
}

export interface SettingsNavGroupDef {
  id: string
  labelKey: string
  items: SettingsNavItemDef[]
}

const canEdit = (ctx: SettingsVisibilityContext) =>
  ctx.hasPermission('settings.edit')

/**
 * The full settings navigation tree. Groups render as accordion headers; items
 * render as leaf links. Each item maps 1:1 to a nested route under /settings.
 */
export const SETTINGS_GROUPS: SettingsNavGroupDef[] = [
  {
    id: 'general',
    labelKey: 'nav.groups.general',
    items: [
      {
        id: 'appearance',
        labelKey: 'sections.appearance.title',
        icon: Palette,
        to: '/settings/appearance',
      },
      {
        id: 'connection',
        labelKey: 'sections.apiUrl.title',
        icon: Wifi,
        to: '/settings/connection',
        visible: (ctx) => ctx.isMobile && canEdit(ctx),
      },
      {
        id: 'sidebar',
        labelKey: 'nav.items.sidebar',
        icon: PanelLeft,
        to: '/settings/sidebar',
        visible: canEdit,
      },
    ],
  },
  {
    id: 'account',
    labelKey: 'nav.groups.account',
    items: [
      {
        id: 'profile',
        labelKey: 'nav.items.profile',
        icon: User,
        to: '/settings/profile',
      },
      {
        id: 'users',
        labelKey: 'nav.items.users',
        icon: Users,
        to: '/settings/users',
        visible: (ctx) => ctx.hasPermission('users.view'),
      },
    ],
  },
  {
    id: 'content',
    labelKey: 'nav.groups.content',
    items: [
      {
        id: 'songs',
        labelKey: 'nav.items.songs',
        icon: Music,
        to: '/settings/songs',
        visible: canEdit,
      },
      {
        id: 'bible',
        labelKey: 'nav.items.bible',
        icon: BookOpen,
        to: '/settings/bible',
        visible: canEdit,
      },
    ],
  },
  {
    id: 'presentation',
    labelKey: 'nav.groups.presentation',
    items: [
      {
        id: 'screens',
        labelKey: 'sections.screens.title',
        icon: Monitor,
        to: '/settings/screens',
        visible: canEdit,
      },
      {
        id: 'kiosk',
        labelKey: 'sections.kiosk.title',
        icon: Tv,
        to: '/settings/kiosk',
        visible: canEdit,
      },
      {
        id: 'livestream',
        labelKey: 'nav.items.livestream',
        icon: Radio,
        to: '/settings/livestream',
        visible: canEdit,
      },
    ],
  },
  {
    id: 'controls',
    labelKey: 'nav.groups.controls',
    items: [
      {
        id: 'shortcuts',
        labelKey: 'nav.items.shortcuts',
        icon: Keyboard,
        to: '/settings/shortcuts',
        visible: canEdit,
      },
      {
        id: 'midi',
        labelKey: 'sections.midi.title',
        icon: Sliders,
        to: '/settings/midi',
        visible: canEdit,
      },
    ],
  },
  {
    id: 'advanced',
    labelKey: 'nav.groups.advanced',
    items: [
      {
        id: 'developer',
        labelKey: 'nav.items.developer',
        icon: Wrench,
        to: '/settings/developer',
        visible: canEdit,
      },
      {
        id: 'about',
        labelKey: 'sections.about.title',
        icon: Info,
        to: '/settings/about',
      },
    ],
  },
]

export function isItemVisible(
  item: SettingsNavItemDef,
  ctx: SettingsVisibilityContext,
): boolean {
  return item.visible ? item.visible(ctx) : true
}

/** Groups (with their items) the user is allowed to see, empty groups dropped. */
export function getVisibleGroups(ctx: SettingsVisibilityContext) {
  return SETTINGS_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => isItemVisible(item, ctx)),
  })).filter((group) => group.items.length > 0)
}

/** First permission-visible leaf — used by the /settings index redirect. */
export function getFirstVisibleLeaf(ctx: SettingsVisibilityContext): string {
  for (const group of SETTINGS_GROUPS) {
    for (const item of group.items) {
      if (isItemVisible(item, ctx)) return item.to
    }
  }
  // About is always visible, so this is a guaranteed fallback.
  return '/settings/about'
}

/**
 * Whether `pathname` is a settings leaf the user is currently allowed to see.
 * Used to validate a remembered section before redirecting to it (permissions
 * may have changed since it was stored).
 */
export function isVisibleLeafPath(
  pathname: string,
  ctx: SettingsVisibilityContext,
): boolean {
  for (const group of SETTINGS_GROUPS) {
    for (const item of group.items) {
      if (item.to === pathname && isItemVisible(item, ctx)) return true
    }
  }
  return false
}

/** Which group owns a given pathname (for default-expand). */
export function findGroupForPath(
  pathname: string,
): SettingsNavGroupDef | undefined {
  return SETTINGS_GROUPS.find((group) =>
    group.items.some((item) => item.to === pathname),
  )
}

/** Look up a single item by id (used by the per-route guard). */
export function findItemById(id: string): SettingsNavItemDef | undefined {
  for (const group of SETTINGS_GROUPS) {
    const item = group.items.find((candidate) => candidate.id === id)
    if (item) return item
  }
  return undefined
}
