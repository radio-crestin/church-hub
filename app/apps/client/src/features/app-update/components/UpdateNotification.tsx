import { NewSongsNotice } from '~/features/song-discovery'
import { AppUpdateNotice } from './AppUpdateNotice'

interface UpdateNotificationProps {
  isCollapsed: boolean
}

/**
 * The sidebar's update notification: a new version of the app, and new songs
 * in the song sources. Each part shows only when it has something to say.
 */
export function UpdateNotification({ isCollapsed }: UpdateNotificationProps) {
  return (
    <>
      <AppUpdateNotice isCollapsed={isCollapsed} />
      <NewSongsNotice isCollapsed={isCollapsed} />
    </>
  )
}
