import { getPassageTemplates, passageKey } from './getPassageTemplates'
import { toBibleTopic } from './listBibleTopics'
import type {
  BibleTopicPassage,
  BibleTopicRecord,
  BibleTopicReference,
  BibleTopicWithPassages,
} from './types'
import { getRawDatabase } from '../../../db'
import { formatRangeReference, getVerseRange } from '../verses'

/**
 * A topic with its references resolved in a translation: each passage's
 * verses, and its reference in that translation's book names. A passage the
 * translation lacks (a missing book) is left out. A passage drawn with its
 * own template carries it.
 */
export function getBibleTopicPassages(
  topicId: number,
  translationId: number,
): BibleTopicWithPassages | null {
  const row = getRawDatabase()
    .query<BibleTopicRecord, [number]>(
      'SELECT * FROM bible_topics WHERE id = ?',
    )
    .get(topicId)
  if (!row) return null

  const references = JSON.parse(row.verse_references) as BibleTopicReference[]
  const templates = getPassageTemplates(topicId)
  const passages: BibleTopicPassage[] = []
  for (const ref of references) {
    const verses = getVerseRange(
      translationId,
      ref.book,
      ref.chapter,
      ref.startVerse,
      ref.endVerse,
    )
    const first = verses[0]
    const last = verses[verses.length - 1]
    if (!first || !last) continue
    passages.push({
      ...ref,
      reference: formatRangeReference(
        first.bookName,
        ref.chapter,
        first.verse,
        last.verse,
      ),
      verses,
      templateId: templates.get(passageKey(ref)) ?? null,
    })
  }
  return { ...toBibleTopic(row), translationId, passages }
}
