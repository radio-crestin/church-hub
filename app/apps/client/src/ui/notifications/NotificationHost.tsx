import { useTranslation } from 'react-i18next'

import { NotificationCard } from './NotificationCard'
import type { Notification } from './types'

interface NotificationHostProps {
  notifications: Notification[]
  onDismiss: (id: string) => void
}

/**
 * The one place that decides where notifications show: top centre, a little
 * below the edge (under the phone header), stacked with even gaps. Clicks
 * pass through the empty space around the cards.
 */
export function NotificationHost({
  notifications,
  onDismiss,
}: NotificationHostProps) {
  const { t } = useTranslation('common')

  return (
    <section
      data-testid="notification-host"
      aria-label={t('notifications.region')}
      className="pointer-events-none fixed inset-x-0 z-[10000] mx-auto flex max-h-[calc(100dvh-6rem)] w-[min(30rem,calc(100vw-2rem))] flex-col gap-3 overflow-hidden top-[calc(env(safe-area-inset-top,0px)+4.75rem)] md:top-[calc(env(safe-area-inset-top,0px)+4rem)]"
    >
      {notifications.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
        />
      ))}
    </section>
  )
}
