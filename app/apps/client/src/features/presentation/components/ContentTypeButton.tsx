import { useNavigate } from '@tanstack/react-router'
import { Book, BookOpen, Music } from 'lucide-react'

import type { TemporaryContent } from '../types'

interface ContentTypeButtonProps {
  temporaryContent: TemporaryContent
}

const baseClassName =
  'flex items-center gap-2 text-sm text-white px-3 py-1.5 rounded-md truncate transition-colors'

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
          className={`${baseClassName} bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600`}
        >
          <Music size={16} className="shrink-0" />
          <span className="truncate">{title}</span>
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
          className={`${baseClassName} bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600`}
        >
          <Book size={16} className="shrink-0" />
          <span className="truncate">{temporaryContent.data.reference}</span>
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
          className={`${baseClassName} bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600`}
        >
          <BookOpen size={16} className="shrink-0" />
          <span className="truncate">
            {bookName} {startChapter}:{currentVerse?.verse ?? 1}
          </span>
        </button>
      )
    }

    default:
      return null
  }
}
