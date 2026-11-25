import { useScheduleFlatNavigation } from '../../hooks'
import { ScheduleItemsPanel } from '../ScheduleItemsPanel'

/**
 * A presentation's items as the presentation page lists them (songs with their
 * slides, passages with their verses), the live step lit; a click puts that
 * step on the screens.
 */
export function PlaylistItems({ scheduleId }: { scheduleId: number }) {
  const nav = useScheduleFlatNavigation({ scheduleId })

  return (
    <ScheduleItemsPanel
      scheduleId={scheduleId}
      items={nav.items}
      isLoading={nav.isLoading}
      onSlideClick={nav.presentSongSlide}
      onVerseClick={nav.presentPassageVerse}
      onEntryClick={nav.presentVerseteEntry}
      onAnnouncementClick={nav.presentAnnouncement}
      onSceneClick={nav.presentScene}
      readOnly
    />
  )
}
