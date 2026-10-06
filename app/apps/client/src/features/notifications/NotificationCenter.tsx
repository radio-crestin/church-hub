import { Bell } from 'lucide-react'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { NotificationCard } from './NotificationCard'
import { useNotifications } from './useNotifications'

/** How long a new notification stays up before it folds under the bell. */
const POP_UP_MS = 12_000
const PANEL_WIDTH = 384

/** Next to the bell, kept on screen (the sidebar is full width on phones). */
function panelPosition(bell: HTMLElement): CSSProperties {
  const rect = bell.getBoundingClientRect()
  return {
    left: Math.max(
      8,
      Math.min(rect.right + 8, window.innerWidth - PANEL_WIDTH - 8),
    ),
    bottom: Math.max(8, window.innerHeight - rect.bottom),
    width: PANEL_WIDTH,
  }
}

interface NotificationCenterProps {
  isCollapsed: boolean
}

/**
 * The bell in the sidebar, with a dot while something is unread. A new
 * notification pops up once, then lives under the bell until dismissed.
 */
export function NotificationCenter({ isCollapsed }: NotificationCenterProps) {
  const { t } = useTranslation('sidebar')
  const { notifications, unread, toPopUp, markSeen, markRead, dismiss } =
    useNotifications()
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null)
  const isOpen = panelStyle !== null
  const bellRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const popUpId = isOpen ? null : (toPopUp?.id ?? null)
  useEffect(() => {
    if (!popUpId) return
    const timer = window.setTimeout(() => markSeen([popUpId]), POP_UP_MS)
    return () => window.clearTimeout(timer)
  }, [popUpId, markSeen])

  // Opening the bell reads everything in it; a click outside closes it.
  const ids = notifications.map((n) => n.id).join('\n')
  useEffect(() => {
    if (!isOpen) return
    markSeen(ids.split('\n'))
    markRead(ids.split('\n'))
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target)) return
      if (bellRef.current?.contains(target)) return
      setPanelStyle(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [isOpen, ids, markSeen, markRead])

  if (notifications.length === 0) return null

  return (
    <div className="mb-2">
      <button
        ref={bellRef}
        type="button"
        onClick={() =>
          setPanelStyle((style) =>
            style || !bellRef.current ? null : panelPosition(bellRef.current),
          )
        }
        data-testid="notification-bell"
        aria-label={t('notifications.title')}
        aria-expanded={isOpen}
        className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 ${isCollapsed ? 'justify-center' : ''}`}
      >
        <span className="relative">
          <Bell size={18} />
          {unread.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unread.length}
            </span>
          )}
        </span>
        {!isCollapsed && <span>{t('notifications.title')}</span>}
      </button>

      {panelStyle &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={t('notifications.title')}
            style={panelStyle}
            className="fixed z-[9998] flex max-h-[70vh] flex-col gap-3 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900"
          >
            {notifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onActed={() => setPanelStyle(null)}
                onClose={
                  notification.dismissible
                    ? () => dismiss(notification)
                    : undefined
                }
              />
            ))}
          </div>,
          document.body,
        )}

      {toPopUp &&
        popUpId &&
        // On the body: the sidebar's own layout must not move or clip it.
        createPortal(
          <div
            role="status"
            data-testid="notification-popup"
            className="fixed right-4 bottom-20 z-[9999] w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
          >
            <NotificationCard
              notification={toPopUp}
              onActed={() => markSeen([toPopUp.id])}
              onClose={() => markSeen([toPopUp.id])}
            />
          </div>,
          document.body,
        )}
    </div>
  )
}
