import { getRawDatabase } from '../../../db'
import type { LibrarySchedulePlayback } from '../types'

/** A synced schedule's automation settings, onto its local row. */
export function writeSchedulePlayback(
  scheduleId: number,
  playback: LibrarySchedulePlayback,
): void {
  getRawDatabase()
    .query(
      `UPDATE schedules SET
         autoplay_seconds = ?, autoplay_by_text = ?, loop = ?,
         music_volume = ?, start_on_app_start = ?, start_trigger = ?,
         stop_trigger = ?
       WHERE id = ?`,
    )
    .run(
      playback.autoplaySeconds,
      playback.autoplayByText,
      playback.loop,
      playback.musicVolume,
      playback.startOnAppStart,
      playback.startTrigger,
      playback.stopTrigger,
      scheduleId,
    )
}
