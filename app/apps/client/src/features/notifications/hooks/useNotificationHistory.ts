import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { useSongUpdates } from '~/features/song-discovery/hooks/useSongUpdates'
import {
  type AppNotification,
  deleteAllNotifications,
  deleteNotification,
  listNotifications,
  markNotificationRead,
  markNotificationsRead,
  NOTIFICATIONS_QUERY_KEY,
} from '../service/notificationsApi'

/** Often while the song sources are checked (each source adds to it). */
const RUNNING_POLL_MS = 3000
const IDLE_POLL_MS = 60_000

/** The notifications history, with which are unread. */
export function useNotificationHistory() {
  const queryClient = useQueryClient()
  const { isRunning } = useSongUpdates()
  const query = useQuery<AppNotification[]>({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: listNotifications,
    refetchInterval: isRunning ? RUNNING_POLL_MS : IDLE_POLL_MS,
  })
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })

  // A finished check may have added one after the last poll.
  const wasRunning = useRef(isRunning)
  useEffect(() => {
    if (wasRunning.current && !isRunning) {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
    }
    wasRunning.current = isRunning
  }, [isRunning, queryClient])

  // Read only on the user's say: a click on one, or "Mark all as read".
  const { mutate: markAllRead } = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: refresh,
  })
  const { mutate: markRead } = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: refresh,
  })
  const { mutate: remove } = useMutation({
    mutationFn: deleteNotification,
    onSuccess: refresh,
  })
  const { mutate: removeAll } = useMutation({
    mutationFn: deleteAllNotifications,
    onSuccess: refresh,
  })

  const notifications = query.data ?? []
  return {
    notifications,
    isLoading: query.isLoading,
    unreadCount: notifications.filter((n) => n.readAt === null).length,
    markAllRead,
    markRead,
    remove,
    removeAll,
  }
}
