import { Link, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { NotificationItem } from './NotificationItem'
import { useNotificationHistory } from '../hooks/useNotificationHistory'
import { markSeen, useSeen } from '../seenNotifications'

/** How long a new notification stays up. */
const POP_UP_MS = 12_000
/** Older news never pops up (a screen opened after days away, say). */
const RECENT_MS = 24 * 60 * 60 * 1000

/**
 * A new notification, once per screen, in the corner: then it waits on the
 * notifications page. Not while that page is open.
 */
export function NotificationPopUp() {
  const { t } = useTranslation('notifications')
  const { pathname } = useLocation()
  const { notifications } = useNotificationHistory()
  const seen = useSeen()

  const next =
    pathname === '/notifications'
      ? undefined
      : notifications.find(
          (n) =>
            n.readAt === null &&
            !seen.includes(n.id) &&
            Date.now() - n.createdAt < RECENT_MS,
        )
  const nextId = next?.id
  useEffect(() => {
    if (!nextId) return
    const timer = window.setTimeout(() => markSeen(nextId), POP_UP_MS)
    return () => window.clearTimeout(timer)
  }, [nextId])

  if (!next) return null
  const close = () => markSeen(next.id)

  // On the body: the sidebar's own layout must not move or clip it.
  return createPortal(
    <div
      role="status"
      data-testid="notification-popup"
      className="fixed right-4 bottom-20 z-[9999] flex max-h-[70vh] w-[26rem] max-w-[calc(100vw-2rem)] flex-col overflow-y-auto rounded-xl bg-white shadow-2xl dark:bg-gray-800"
    >
      <NotificationItem
        notification={next}
        isNew={false}
        onClose={close}
        closeLabel={t('close')}
        onActed={close}
        compact
      />
      <Link
        to="/notifications"
        onClick={close}
        className="px-4 py-2 text-right text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-300"
      >
        {t('seeAll')}
      </Link>
    </div>,
    document.body,
  )
}
