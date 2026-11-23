import type { ScheduleStep } from './buildScheduleSteps'
import { nextItemPreview } from './nextItemPreview'
import { createLogger } from '../../utils/logger'
import { broadcastOBSCurrentScene } from '../../websocket'
import { switchScene } from '../livestream/obs/scenes'
import {
  presentTemporaryAnnouncement,
  presentTemporaryBiblePassage,
  presentTemporaryScene,
  presentTemporarySong,
  presentTemporaryVerseteTineri,
} from '../presentation/presentation-state'
import type { PresentationState } from '../presentation/types'
import type { ScheduleItem } from '../schedules/types'

const logger = createLogger('schedule-automation')

/** "Psalmii 34:1" → its book, chapter and verse. */
function parseReference(reference: string) {
  const match = reference.match(/(.+?)\s+(\d+):(\d+)/)
  if (!match) return { bookName: '', chapter: 1, verse: 1 }
  const [, bookName = '', chapter = '1', verse = '1'] = match
  return {
    bookName,
    chapter: Number.parseInt(chapter, 10),
    verse: Number.parseInt(verse, 10),
  }
}

/**
 * Puts one step of a presentation on the projector, carrying the presentation
 * and the step's position as every page does (`scheduleId` +
 * `scheduleItemIndex`), so the rows light up the same as a manual run.
 */
export async function presentScheduleStep(
  scheduleId: number,
  items: ScheduleItem[],
  step: ScheduleStep,
  stepIndex: number,
): Promise<PresentationState> {
  const { item, index } = step
  const common = {
    nextItemPreview: nextItemPreview(items, item),
    scheduleId,
    scheduleItemIndex: stepIndex,
  }

  switch (step.type) {
    case 'slide':
      return presentTemporarySong({
        songId: item.songId as number,
        slideIndex: index,
        ...common,
      })
    case 'verse': {
      const verses = item.biblePassageVerses
      const first = parseReference(verses[0]?.reference ?? '')
      const last = parseReference(verses.at(-1)?.reference ?? '')
      return presentTemporaryBiblePassage({
        translationId: 0,
        translationAbbreviation: item.biblePassageTranslation || '',
        bookCode: '',
        bookName: first.bookName,
        startChapter: first.chapter,
        startVerse: first.verse,
        endChapter: last.chapter,
        endVerse: last.verse,
        verses: verses.map((v) => ({
          verseId: v.verseId,
          verse: parseReference(v.reference).verse,
          text: v.text,
        })),
        currentVerseIndex: index,
        ...common,
      })
    }
    case 'entry':
      return presentTemporaryVerseteTineri({
        entries: item.verseteTineriEntries.map((e) => ({
          id: e.id,
          personName: e.personName,
          reference: e.reference,
          bookCode: e.bookCode,
          bookName: e.bookName,
          startChapter: e.startChapter,
          startVerse: e.startVerse,
          endChapter: e.endChapter,
          endVerse: e.endVerse,
          text: e.text,
          sortOrder: e.sortOrder,
        })),
        currentEntryIndex: index,
        ...common,
      })
    case 'scene': {
      const sceneName = item.obsSceneName ?? ''
      try {
        await switchScene(sceneName)
        broadcastOBSCurrentScene(sceneName)
      } catch (error) {
        // OBS may not be connected; the empty slide still goes up.
        logger.warning(`Failed to switch OBS scene "${sceneName}": ${error}`)
      }
      return presentTemporaryScene({ obsSceneName: sceneName, ...common })
    }
    case 'announcement':
      return presentTemporaryAnnouncement({
        content: item.slideContent ?? '',
        ...common,
      })
  }
}
