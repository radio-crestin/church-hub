import {
  ChevronLeft,
  ChevronRight,
  MonitorPlay,
  Radio,
  Square,
} from 'lucide-react'

import type { ShortcutActionMeta } from '../types'

const meta = (
  id: ShortcutActionMeta['id'],
  icon: ShortcutActionMeta['icon'],
): ShortcutActionMeta => ({
  id,
  icon,
  labelKey: `sections.shortcuts.actions.${id}.label`,
  descriptionKey: `sections.shortcuts.actions.${id}.description`,
})

/** Global presentation actions (work from anywhere in the app). */
export const PRESENTATION_SHORTCUT_ACTIONS: ShortcutActionMeta[] = [
  meta('showSlide', MonitorPlay),
  meta('nextSlide', ChevronRight),
  meta('prevSlide', ChevronLeft),
]

/** Global livestream actions. */
export const LIVESTREAM_SHORTCUT_ACTIONS: ShortcutActionMeta[] = [
  meta('startLive', Radio),
  meta('stopLive', Square),
]
