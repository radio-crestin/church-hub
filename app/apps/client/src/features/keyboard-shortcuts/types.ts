import type { LucideIcon } from 'lucide-react'

export type GlobalShortcutActionId =
  | 'startLive'
  | 'stopLive'
  | 'searchSong'
  | 'searchBible'

export interface ShortcutActionConfig {
  shortcuts: string[]
  enabled: boolean
}

export interface GlobalShortcutsConfig {
  actions: Record<GlobalShortcutActionId, ShortcutActionConfig>
  version: number
}

export interface ShortcutConflict {
  shortcut: string
  conflictSource: 'global' | 'scene'
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
    searchSong: { shortcuts: [], enabled: true },
    searchBible: { shortcuts: [], enabled: true },
  },
  version: 1,
}
