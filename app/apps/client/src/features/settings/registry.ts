import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  CloudUpload,
  DownloadCloud,
  Info,
  Keyboard,
  LibraryBig,
  Monitor,
  Music,
  Palette,
  PanelLeft,
  Radio,
  ScrollText,
  ShieldCheck,
  Sliders,
  Smartphone,
  SwatchBook,
  Tv,
  User,
  Users,
  Wifi,
  Wrench,
} from 'lucide-react'

import { isWebApp } from '~/config'
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
  /** Settings of the church PC itself (its hardware, files, network): the web app hides them. */
  pcOnly?: boolean
  /**
   * The settings shown on this page, as `namespace:key` i18n keys of their
   * visible labels: what the settings search finds and highlights.
   */
  settings?: string[]
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
        settings: [
          'settings:sections.language.title',
          'settings:sections.theme.title',
        ],
      },
      {
        id: 'connection',
        labelKey: 'sections.apiUrl.title',
        icon: Wifi,
        to: '/settings/connection',
        visible: (ctx) => ctx.isMobile && canEdit(ctx),
        settings: ['settings:sections.apiUrl.label'],
      },
      {
        id: 'phones',
        labelKey: 'sections.phones.title',
        icon: Smartphone,
        to: '/settings/phones',
        pcOnly: true,
        // The computer shows the code; a phone in the app connects itself.
        visible: (ctx) => !ctx.isMobile && ctx.hasPermission('users.view'),
        settings: ['settings:sections.phones.account'],
      },
      {
        id: 'sidebar',
        labelKey: 'nav.items.sidebar',
        icon: PanelLeft,
        to: '/settings/sidebar',
        visible: canEdit,
        settings: ['settings:sections.sidebar.title'],
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
        settings: ['users:profile.permissions'],
      },
      {
        id: 'users',
        labelKey: 'nav.items.users',
        icon: Users,
        to: '/settings/users',
        visible: (ctx) => ctx.hasPermission('users.view'),
        settings: ['settings:sections.users.title'],
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
        settings: [
          'songs:editorLayout.title',
          'settings:sections.categories.title',
          'settings:sections.tags.title',
          'settings:sections.importExport.title',
          'settings:sections.importExport.import.title',
          'settings:sections.importExport.resurseCrestine.title',
          'settings:sections.importExport.export.title',
          'songDiscovery:settings.title',
          'songDiscovery:settings.enableLabel',
          'songDiscovery:songSources.title',
          'songDiscovery:songSources.links.title',
          'songDiscovery:songSources.storage.title',
          'songDiscovery:songSources.publish.title',
          'settings:sections.synonyms.title',
          'settings:sections.aiSearch.title',
        ],
      },
      {
        id: 'song-library',
        labelKey: 'nav.items.songLibrary',
        icon: LibraryBig,
        to: '/settings/song-library',
        // Curating signs in with Google like the church's owner: users.edit.
        visible: (ctx) => ctx.hasPermission('users.edit'),
        settings: ['songLibrary:curator.title'],
      },
      {
        id: 'bible',
        labelKey: 'nav.items.bible',
        icon: BookOpen,
        to: '/settings/bible',
        visible: canEdit,
        settings: [
          'settings:sections.bible.title',
          'bible:settings.download.title',
          'bible:settings.import.title',
          'settings:sections.bibleAiSearch.title',
        ],
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
        settings: [
          'settings:sections.screens.idle.clock.label',
          'settings:sections.screens.closeOnEscape.label',
          'settings:sections.screens.openOnStartup.label',
          'presentation:screens.monitor.label',
          'settings:sections.screens.previewScreen.label',
          'settings:sections.screens.fullscreen.label',
          'settings:sections.screens.alwaysOnTop.label',
        ],
      },
      {
        id: 'themes',
        labelKey: 'sections.themes.title',
        icon: SwatchBook,
        to: '/settings/themes',
        visible: canEdit,
        settings: ['presentation:templates.page.title'],
      },
      {
        id: 'kiosk',
        labelKey: 'sections.kiosk.title',
        icon: Tv,
        to: '/settings/kiosk',
        visible: canEdit,
        settings: [
          'settings:sections.kiosk.enable.label',
          'settings:sections.kiosk.startupPage.label',
        ],
      },
      {
        id: 'livestream',
        labelKey: 'nav.items.livestream',
        icon: Radio,
        to: '/settings/livestream',
        pcOnly: true,
        visible: canEdit,
        settings: ['livestream:scenes.title'],
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
        settings: [
          'settings:sections.shortcuts.actions.showSlide.label',
          'settings:sections.shortcuts.actions.nextSlide.label',
          'settings:sections.shortcuts.actions.prevSlide.label',
          'settings:sections.shortcuts.actions.startLive.label',
          'settings:sections.shortcuts.actions.stopLive.label',
          'settings:sections.sidebarItem.shortcuts.switchTitle',
          'settings:sections.sidebarItem.shortcuts.focusSearchTitle',
        ],
      },
      {
        id: 'midi',
        labelKey: 'sections.midi.title',
        icon: Sliders,
        to: '/settings/midi',
        pcOnly: true,
        visible: canEdit,
        settings: [
          'settings:sections.shortcuts.midi.inputDevice',
          'settings:sections.shortcuts.midi.outputDevice',
        ],
      },
    ],
  },
  {
    id: 'advanced',
    labelKey: 'nav.groups.advanced',
    items: [
      {
        id: 'logs',
        labelKey: 'nav.items.logs',
        icon: ScrollText,
        to: '/settings/logs',
        pcOnly: true,
        visible: (ctx) => ctx.hasPermission('logs.view'),
        settings: [
          'settings:sections.logs.title',
          'settings:sections.logs.clear.card.title',
        ],
      },
      {
        id: 'backup',
        labelKey: 'nav.items.backup',
        icon: CloudUpload,
        to: '/settings/backup',
        pcOnly: true,
        visible: (ctx) => ctx.isLocalhost && canEdit(ctx),
        settings: [
          'settings:sections.backup.title',
          'settings:sections.backup.local.title',
          'settings:sections.backup.auto.title',
          'settings:sections.backup.retention.title',
          'settings:sections.sync.title',
          'settings:sections.sync.toggle.title',
        ],
      },
      {
        id: 'developer',
        labelKey: 'nav.items.developer',
        icon: Wrench,
        to: '/settings/developer',
        visible: canEdit,
        settings: [
          'settings:sections.debug.title',
          'settings:sections.apiDocs.title',
          'settings:sections.systemToken.title',
          'settings:sections.searchIndex.card.title',
          'settings:sections.database.title',
          'settings:sections.factoryReset.title',
        ],
      },
      {
        // Downloading and installing a new version is driven by the sidecar,
        // so this is only meaningful on the machine running it.
        id: 'updates',
        labelKey: 'nav.items.updates',
        icon: DownloadCloud,
        to: '/settings/updates',
        pcOnly: true,
        visible: (ctx) => ctx.isLocalhost && canEdit(ctx),
        settings: ['settings:sections.updates.title'],
      },
      {
        id: 'privacy',
        labelKey: 'nav.items.privacy',
        icon: ShieldCheck,
        to: '/settings/privacy',
      },
      {
        id: 'about',
        labelKey: 'sections.about.title',
        icon: Info,
        to: '/settings/about',
        settings: ['settings:sections.about.currentVersion'],
      },
    ],
  },
]

export function isItemVisible(
  item: SettingsNavItemDef,
  ctx: SettingsVisibilityContext,
): boolean {
  if (isWebApp && item.pcOnly) return false
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
