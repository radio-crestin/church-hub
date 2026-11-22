import type { LucideIcon } from 'lucide-react'

/** A section of a settings page, listed in the rail under "On this page". */
export interface SettingsPageSection {
  /** The section card's `data-testid` (its SettingsSection testId). */
  id: string
  label: string
  icon: LucideIcon
}
