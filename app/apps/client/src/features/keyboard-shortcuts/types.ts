import type { LucideIcon } from 'lucide-react'

import type { MIDIConfig } from './midi/types'

export type GlobalShortcutActionId =
  | 'startLive'
  | 'stopLive'
  | 'showSlide'
  | 'nextSlide'
  | 'prevSlide'

/**
 * Where a key works: `app` only while a Church Hub window has the keyboard,
 * `system` from any program (the desktop shell holds it OS-wide).
 */
export type ShortcutScope = 'app' | 'system'

/** What a key does, which decides where it works unless the user chose. */
export type ShortcutKind = 'sidebar' | 'page' | 'action' | 'scene'

export interface ShortcutActionConfig {
  shortcuts: string[]
  enabled: boolean
}

export interface GlobalShortcutsConfig {
  actions: Record<GlobalShortcutActionId, ShortcutActionConfig>
  /**
   * Where each key works, chosen per key (any spelling of it, matched through
   * `canonicalShortcut`). A key not listed takes its kind's default: see
   * `shortcutScope`.
   */
  keyScopes?: Record<string, ShortcutScope>
  midi?: MIDIConfig
  version: number
}

export interface ShortcutConflict {
  shortcut: string
  conflictSource: 'global' | 'scene' | 'sidebar'
  conflictName: string
}

export interface ShortcutActionMeta {
  id: GlobalShortcutActionId
  labelKey: string
  descriptionKey: string
  icon: LucideIcon
}

export const DEFAULT_SHORTCUTS_CONFIG: GlobalShortcutsConfig = {
  actions: {
    startLive: { shortcuts: [], enabled: true },
    stopLive: { shortcuts: [], enabled: true },
    showSlide: { shortcuts: [], enabled: true },
    nextSlide: { shortcuts: [], enabled: true },
    prevSlide: { shortcuts: [], enabled: true },
  },
  version: 1,
}
