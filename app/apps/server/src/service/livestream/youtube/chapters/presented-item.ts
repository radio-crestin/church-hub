import { removeXmlTags } from '../../../../utils/removeXmlTags'
import type { PresentationState } from '../../../presentation/types'

/** A song, verse or passage shown on the screens, as the description lists it. */
export interface PresentedItem {
  /** Same key: the same song or passage (a song's slides are one item). */
  key: string
  title: string
  text: string
  /** A single verse: the chapter it is in, so the next verse extends it. */
  verse?: { chapterTitle: string; number: number }
}

/** Plain text: line breaks kept, tags dropped, no `<` or `>` (YouTube refuses them). */
export function toPlainText(html: string): string {
  return removeXmlTags(html.replace(/<br\s*\/?>|<\/p>|<\/div>/gi, '\n'))
    .replace(/[<>]/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * What the screens show, as a description item; null for what the
 * description doesn't list (nothing, hidden, announcements, scenes).
 */
export function toPresentedItem(
  state: PresentationState,
): PresentedItem | null {
  const content = state.temporaryContent
  if (!state.isPresenting || state.isHidden || !content) return null

  switch (content.type) {
    case 'song': {
      const { songId, title, slides } = content.data
      // Choruses repeat in the expanded slides: each slide once.
      const unique = [...new Map(slides.map((s) => [s.id, s])).values()]
      return {
        key: `song:${songId}`,
        title: toPlainText(title),
        text: unique.map((s) => toPlainText(s.content)).join('\n\n'),
      }
    }
    case 'bible': {
      const { translationId, bookId, bookName, chapter, currentVerseIndex } =
        content.data
      const chapterTitle = `${bookName} ${chapter}`
      const number = currentVerseIndex + 1
      return {
        key: `bible:${translationId}:${bookId}:${chapter}`,
        title: `${chapterTitle}:${number}`,
        text: `${number} ${toPlainText(content.data.text)}`,
        verse: { chapterTitle, number },
      }
    }
    case 'bible_passage': {
      const { bookName, startChapter, startVerse, endChapter, endVerse } =
        content.data
      const end =
        endChapter === startChapter
          ? `${endVerse}`
          : `${endChapter}:${endVerse}`
      const title =
        `${bookName} ${startChapter}:${startVerse}` +
        (end === `${startVerse}` ? '' : `-${end}`)
      return {
        key: `passage:${content.data.translationId}:${title}`,
        title,
        text: content.data.verses
          .map((v) => `${v.verse} ${toPlainText(v.text)}`)
          .join('\n'),
      }
    }
    case 'versete_tineri': {
      const entry = content.data.entries[content.data.currentEntryIndex]
      if (!entry) return null
      return {
        key: `versete:${entry.id}`,
        title: toPlainText(entry.reference),
        text: toPlainText(entry.text),
      }
    }
    default:
      return null
  }
}
