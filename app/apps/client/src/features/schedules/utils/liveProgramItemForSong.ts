import type { ScheduleFlatItem } from './scheduleFlatItems'
import type { ScheduleItem } from '../types'

interface SelectedProgram {
  /** Whether a step of this program is on the projector. */
  isScheduleLive: boolean
  items: ScheduleItem[]
  flatItems: ScheduleFlatItem[]
  currentFlatIndex: number
}

/**
 * The program item a slide of this song goes up as, or null when the song is
 * presented on its own.
 *
 * Only a program that is already on the projector claims the song. Presenting
 * from the song page while the selected program sits idle is a presentation of
 * the song: turning it into a program step lit the program's row up as live and
 * sent Next on into the program's other items. A song can sit in a program
 * twice, so the occurrence already on the projector wins — that is the one the
 * operator is working through.
 */
export function liveProgramItemForSong(
  program: SelectedProgram,
  songId: number,
): ScheduleItem | null {
  if (!program.isScheduleLive) return null
  const liveItem = program.flatItems[program.currentFlatIndex]?.item
  if (liveItem?.itemType === 'song' && liveItem.songId === songId) {
    return liveItem
  }
  return (
    program.items.find(
      (item) => item.itemType === 'song' && item.songId === songId,
    ) ?? null
  )
}
