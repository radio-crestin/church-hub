import { randomBookReferences } from './randomBookReferences'
import { shuffle } from './shuffle'
import type { VersesItemConfig } from './types'
import { getBibleTopicReferences } from '../bible/topics'
import type { BibleTopicReference } from '../bible/topics/types'
import { formatRangeReference, getVerseRange } from '../bible/verses'
import type { ScheduleVerseteTineriEntry } from '../schedules/types'

function sourceReferences(config: VersesItemConfig): BibleTopicReference[] {
  switch (config.source) {
    case 'topic':
      return getBibleTopicReferences(config.topicKey)
    case 'book':
      return randomBookReferences(
        config.translationId,
        config.bookCode,
        config.count ?? 1,
      )
  }
}

/**
 * The passages a verses item shows this time, with their text in its
 * translation: all of a topic's in order, or `count` picked at random. A
 * passage the translation lacks is left out.
 */
export function pickVerseEntries(
  config: VersesItemConfig,
): ScheduleVerseteTineriEntry[] {
  const all = sourceReferences(config)
  const picked =
    config.count === null || config.source === 'book'
      ? all
      : shuffle(all).slice(0, config.count)

  const entries: ScheduleVerseteTineriEntry[] = []
  for (const ref of picked) {
    const verses = getVerseRange(
      config.translationId,
      ref.book,
      ref.chapter,
      ref.startVerse,
      ref.endVerse,
    )
    const first = verses[0]
    const last = verses.at(-1)
    if (!first || !last) continue
    entries.push({
      id: entries.length + 1,
      personName: '',
      translationId: config.translationId,
      bookCode: first.bookCode,
      bookName: first.bookName,
      reference: formatRangeReference(
        first.bookName,
        ref.chapter,
        first.verse,
        last.verse,
      ),
      text: verses.map((v) => v.text).join(' '),
      startChapter: ref.chapter,
      startVerse: first.verse,
      endChapter: ref.chapter,
      endVerse: last.verse,
      sortOrder: entries.length,
    })
  }
  return entries
}
