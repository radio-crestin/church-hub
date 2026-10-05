/**
 * The app's one notification system. Every toast and status banner goes
 * through it; NotificationHost alone decides where and how they show (top
 * centre, a little below the edge, stacked with even gaps).
 *
 *   const { notify, dismiss, showToast } = useNotifications()
 *
 *   showToast(t('saved'), 'success')            // short-lived, message only
 *   notify({ kind: 'warning', title, message, action: { label, onClick } })
 *   notify({ id: 'sync', message, persistent: true })  // stays until dismiss
 *   dismiss('sync')
 *
 * - kind: info | success | warning | error (default info).
 * - id: the same id updates the shown notification instead of adding another.
 * - persistent: no timeout; default duration is 4 s, errors 6 s.
 * - A banner tied to a condition: useNotificationWhile(condition, options).
 * Texts come from i18n (en + ro); never pass a hard-coded string.
 */
import { useContext } from 'react'

import { NotificationsContext } from './NotificationsContext'

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error(
      'useNotifications must be used within a NotificationsProvider',
    )
  }
  return context
}
