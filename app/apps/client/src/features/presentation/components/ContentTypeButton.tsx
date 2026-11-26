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
  'flex min-w-0 shrink items-center gap-2 h-8 rounded-lg px-3 text-sm font-medium bg-field text-fg hover:bg-hover transition-colors'

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
          className={baseClassName}
        >
          <Music
            size={16}
            strokeWidth={1.5}
            className="shrink-0 text-fg-label"
          />
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
          className={baseClassName}
        >
          <Book
            size={16}
            strokeWidth={1.5}
            className="shrink-0 text-fg-label"
          />
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
          className={baseClassName}
        >
          <BookOpen
            size={16}
            strokeWidth={1.5}
            className="shrink-0 text-fg-label"
          />
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
