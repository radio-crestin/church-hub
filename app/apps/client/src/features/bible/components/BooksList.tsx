import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { BibleBook } from '../types'

interface BooksListProps {
  books: BibleBook[]
  isLoading: boolean
  onSelectBook: (bookId: number, bookName: string) => void
}

const OLD_TESTAMENT_COUNT = 39

export function BooksList({ books, isLoading, onSelectBook }: BooksListProps) {
  const { t } = useTranslation('bible')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  if (books.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        {t('navigation.noBooks')}
      </div>
    )
  }

  const oldTestamentBooks = books.filter(
    (book) => book.bookOrder <= OLD_TESTAMENT_COUNT,
  )
  const newTestamentBooks = books.filter(
    (book) => book.bookOrder > OLD_TESTAMENT_COUNT,
  )

  return (
    <div className="space-y-4">
      {oldTestamentBooks.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
            {t('navigation.oldTestament')}
          </h3>
          <div className="grid grid-cols-2 gap-1">
            {oldTestamentBooks.map((book) => (
              <button
                key={book.id}
                type="button"
                onClick={() => onSelectBook(book.id, book.bookName)}
                className="text-left px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors truncate"
              >
                {book.bookName}
              </button>
            ))}
          </div>
        </div>
      )}

      {newTestamentBooks.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
            {t('navigation.newTestament')}
          </h3>
          <div className="grid grid-cols-2 gap-1">
            {newTestamentBooks.map((book) => (
              <button
                key={book.id}
                type="button"
                onClick={() => onSelectBook(book.id, book.bookName)}
                className="text-left px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors truncate"
              >
                {book.bookName}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
