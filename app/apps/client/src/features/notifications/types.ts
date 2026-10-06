import type { LucideIcon } from 'lucide-react'

/** One line of a notification, e.g. a song source and its new songs. */
export interface NotificationLine {
  key: string
  label: string
  value: string
  onClick?: () => void
}

/**
 * Something the app tells the user once (as a pop-up) and keeps under the
 * bell until dismissed. Its id changes when its news does, so news shows
 * again and the same news never does.
 */
export interface AppNotification {
  id: string
  icon: LucideIcon
  title: string
  description?: string
  lines?: NotificationLine[]
  action?: { label: string; onClick: () => void }
  /** Leaves the bell; false for news that waits on the user (an update ready to install). */
  dismissible: boolean
  /** What else dismissing does, e.g. the app update's own "dismissed". */
  onDismiss?: () => void
}
