import { useAppUpdateNotification } from '~/features/app-update/hooks/useAppUpdateNotification'
import { useSongsNotification } from '~/features/song-discovery/hooks/useSongsNotification'
import { addMark, useMarks } from './notificationMarks'
import type { AppNotification } from './types'

const markSeen = (ids: string[]) => addMark('seen', ids)
const markRead = (ids: string[]) => addMark('read', ids)

/**
 * Everything the app has to tell the user, newest kind first, without the
 * ones dismissed; with which are unread and which never popped up.
 */
export function useNotifications() {
  const appUpdate = useAppUpdateNotification()
  const songs = useSongsNotification()
  const dismissed = useMarks('dismissed')
  const read = useMarks('read')
  const seen = useMarks('seen')

  const notifications = [appUpdate, songs].filter(
    (n): n is AppNotification => n !== null && !dismissed.includes(n.id),
  )

  return {
    notifications,
    unread: notifications.filter((n) => !read.includes(n.id)),
    /** The first notification not yet shown as a pop-up. */
    toPopUp: notifications.find((n) => !seen.includes(n.id)) ?? null,
    markSeen,
    markRead,
    dismiss: (notification: AppNotification) => {
      notification.onDismiss?.()
      addMark('dismissed', [notification.id])
    },
  }
}
