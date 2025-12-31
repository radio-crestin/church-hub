import { Loader2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useLocalizedBookNames } from '../hooks'
import type { BibleBook } from '../types'

interface BooksListProps {
  books: BibleBook[]
  isLoading: boolean
  onSelectBook: (bookId: number, bookName: string) => void
}

const OLD_TESTAMENT_COUNT = 39

export function BooksList({ books, isLoading, onSelectBook }: BooksListProps) {
  const { t } = useTranslation('bible')
  const { getBookName, hasBookTranslation } = useLocalizedBookNames()

  // Filter books to only show those with available translations
  // All hooks must be called before any early returns
  const booksWithTranslations = useMemo(() => {
    return books.filter((book) => hasBookTranslation(book.bookCode))
  }, [books, hasBookTranslation])

  const oldTestamentBooks = useMemo(() => {
    return booksWithTranslations.filter(
      (book) => book.bookOrder <= OLD_TESTAMENT_COUNT,
    )
  }, [booksWithTranslations])

  const newTestamentBooks = useMemo(() => {
    return booksWithTranslations.filter(
      (book) => book.bookOrder > OLD_TESTAMENT_COUNT,
    )
  }, [booksWithTranslations])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  if (booksWithTranslations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        {t('navigation.noBooks')}
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto space-y-4">
      {oldTestamentBooks.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
            {t('navigation.oldTestament')}
          </h3>
          <div className="grid grid-cols-2 gap-1">
            {oldTestamentBooks.map((book) => {
              const localizedName = getBookName(book.bookCode) || book.bookName
              return (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => onSelectBook(book.id, localizedName)}
                  className="text-left px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors truncate"
                >
                  {localizedName}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {newTestamentBooks.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
            {t('navigation.newTestament')}
          </h3>
          <div className="grid grid-cols-2 gap-1">
            {newTestamentBooks.map((book) => {
              const localizedName = getBookName(book.bookCode) || book.bookName
              return (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => onSelectBook(book.id, localizedName)}
                  className="text-left px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors truncate"
                >
                  {localizedName}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
