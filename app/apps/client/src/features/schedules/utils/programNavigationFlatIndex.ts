import type { TemporaryContent } from '~/features/presentation'
import { liveScheduleFlatIndex } from './liveScheduleFlatIndex'
import type { ScheduleFlatItem } from './scheduleFlatItems'

/** Whether a program step puts up the same slide or verse as `content`. */
function stepShows(step: ScheduleFlatItem, content: TemporaryContent): boolean {
  switch (content.type) {
    case 'song':
      return (
        step.type === 'slide' &&
        step.item.songId === content.data.songId &&
        step.index === content.data.currentSlideIndex
      )
    case 'bible':
    case 'bible_passage': {
      const verseId =
        content.type === 'bible'
          ? content.data.verseId
          : content.data.verses[content.data.currentVerseIndex]?.verseId
      return (
        verseId !== undefined &&
        step.type === 'verse' &&
        step.item.biblePassageVerses[step.index]?.verseId === verseId
      )
    }
    default:
      return false
  }
}

/**
 * The step a program's Next and Prev move from: the live step while the
 * program is on the projector, otherwise the step of the program that shows
 * what the projector shows. -1 when nothing of the program is up.
 *
 * Presenting a song from the song page leaves an idle program alone (see
 * liveProgramItemForSong), and so does a verse from the Bible page, so that
 * content carries no place in the program. Walking the program from there must
 * still carry on from the slide on screen — starting over from the program's
 * first step threw the operator back to its opening song. So the content is
 * matched on what it is: the song's slide, or — for a passage stepped verse by
 * verse — the verse by its id. Announcements, scenes and Versete Biblice /
 * Tineri entries only ever go up as program steps; a lone verse from the Bible
 * page is not the entry holding it, which shows the whole reading at once.
 *
 * A song can sit in a program twice (a service often opens and closes with the
 * same one). The occurrence the program was last at, or the first after it, is
 * the one the operator is working through; with no known position, or with
 * every occurrence behind it, the first.
 */
export function programNavigationFlatIndex(
  temporaryContent: TemporaryContent | null | undefined,
  scheduleId: number | null | undefined,
  flatItems: ScheduleFlatItem[],
  lastProgramFlatIndex: number,
): number {
  const liveFlatIndex = liveScheduleFlatIndex(temporaryContent, scheduleId)
  if (liveFlatIndex >= 0 || !scheduleId || !temporaryContent) {
    return liveFlatIndex
  }

  let firstMatch = -1
  for (let flatIndex = 0; flatIndex < flatItems.length; flatIndex++) {
    const step = flatItems[flatIndex]
    if (!stepShows(step, temporaryContent)) continue
    if (firstMatch < 0) firstMatch = flatIndex

    let itemEnd = flatIndex
    while (flatItems[itemEnd + 1]?.item.id === step.item.id) itemEnd++
    if (itemEnd >= lastProgramFlatIndex) return flatIndex
  }
  return firstMatch
}
