import type { LucideIcon } from 'lucide-react'

import type { MIDIConfig } from './midi/types'

export type GlobalShortcutActionId =
  | 'startLive'
  | 'stopLive'
  | 'showSlide'
  | 'nextSlide'
  | 'prevSlide'

export interface ShortcutActionConfig {
  shortcuts: string[]
  enabled: boolean
}

export interface GlobalShortcutsConfig {
  actions: Record<GlobalShortcutActionId, ShortcutActionConfig>
  /**
   * Presentation, livestream and OBS scene keys are held OS-wide by default,
   * so they work while another program is in front. True holds them only
   * while Church Hub is in front, leaving keys like F1–F12 to that program.
   */
  onlyWhenAppFocused?: boolean
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
  onlyWhenAppFocused: false,
  version: 1,
}
