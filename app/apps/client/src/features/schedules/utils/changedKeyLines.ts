import type { ParsedScheduleItem } from './parseScheduleText'
import type { SongKeyLineEdit } from '../service/saveSongKeyLines'
import type { ScheduleItem } from '../types'

/**
 * The gamas written in "Edit as text" that differ from what the program
 * already shows. `songIds[i]` is the song resolved for `parsed[i]`; lines
 * without braces leave their song's gama alone.
 */
export function changedKeyLines(
  parsed: ParsedScheduleItem[],
  songIds: (number | undefined)[],
  currentItems: ScheduleItem[],
): SongKeyLineEdit[] {
  const shownKeyLine = new Map(
    currentItems
      .filter((item) => item.songId !== null)
      .map((item) => [item.songId as number, item.keyLine ?? '']),
  )
  const edits: SongKeyLineEdit[] = []
  parsed.forEach((item, index) => {
    const songId = songIds[index]
    if (item.type !== 'song' || item.keyLine === undefined || !songId) return
    if (shownKeyLine.get(songId) === item.keyLine) return
    edits.push({ songId, keyLine: item.keyLine })
  })
  return edits
}
