import { useNavigate } from '@tanstack/react-router'
import { Book, BookOpen, Music } from 'lucide-react'

import type { TemporaryContent } from '../types'

interface ContentTypeButtonProps {
  temporaryContent: TemporaryContent
}

// `min-w-0` lets the button shrink inside a flex parent so the inner span's
// `truncate` actually applies an ellipsis instead of pushing the layout
// wider. Used in the song detail header where a long title used to crowd
// out the LIVE indicator next to it.
const baseClassName =
  'flex min-w-0 shrink items-center gap-2 rounded-md px-3 py-1.5 text-sm text-white transition-colors'

export function ContentTypeButton({
  temporaryContent,
}: ContentTypeButtonProps) {
  const navigate = useNavigate()

  // Navigate to content source directly based on type
  switch (temporaryContent.type) {
    case 'song': {
      const { songId, title } = temporaryContent.data
      return (
        <button
          type="button"
          onClick={() =>
            navigate({
              to: '/songs/$songId',
              params: { songId: String(songId) },
            })
          }
          title={title}
          className={`${baseClassName} bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600`}
        >
          <Music size={16} className="shrink-0" />
          <span className="truncate min-w-0">{title}</span>
        </button>
      )
    }

    case 'bible': {
      const { bookId, bookName, chapter, currentVerseIndex } =
        temporaryContent.data
      const verse = currentVerseIndex + 1
      return (
        <button
          type="button"
          onClick={() =>
            navigate({
              to: '/bible',
              search: { book: bookId, bookName, chapter, verse },
            })
          }
          title={temporaryContent.data.reference}
          className={`${baseClassName} bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600`}
        >
          <Book size={16} className="shrink-0" />
          <span className="truncate min-w-0">
            {temporaryContent.data.reference}
          </span>
        </button>
      )
    }

    case 'bible_passage': {
      const { bookId, bookName, startChapter, verses, currentVerseIndex } =
        temporaryContent.data
      const currentVerse = verses[currentVerseIndex]
      return (
        <button
          type="button"
          onClick={() =>
            navigate({
              to: '/bible',
              search: {
                ...(bookId && { book: bookId }),
                bookName,
                chapter: startChapter,
                verse: currentVerse?.verse ?? 1,
              },
            })
          }
          title={`${bookName} ${startChapter}:${currentVerse?.verse ?? 1}`}
          className={`${baseClassName} bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600`}
        >
          <BookOpen size={16} className="shrink-0" />
          <span className="truncate min-w-0">
            {bookName} {startChapter}:{currentVerse?.verse ?? 1}
          </span>
        </button>
      )
    }

    default:
      return null
  }
}
