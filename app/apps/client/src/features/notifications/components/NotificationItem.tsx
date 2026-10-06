import { AppUpdateNotification } from '~/features/app-update/components/AppUpdateNotification'
import { SongSyncNotification } from '~/features/song-discovery/components/SongSyncNotification'
import type { AppNotification } from '../service/notificationsApi'

interface NotificationItemProps {
  notification: AppNotification
  isNew: boolean
  onClose?: () => void
  closeLabel?: string
  /** After the user opened or did something from it. */
  onActed?: () => void
  /** The pop-up: the summary and the buttons, without the details. */
  compact?: boolean
}

/** One notification, drawn by the feature it is about. */
export function NotificationItem(props: NotificationItemProps) {
  switch (props.notification.kind) {
    case 'songs-synced':
    case 'songs-pending':
      return <SongSyncNotification {...props} />
    case 'app-update':
      return <AppUpdateNotification {...props} />
  }
}
