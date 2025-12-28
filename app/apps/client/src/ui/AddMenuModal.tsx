import {
  Book,
  BookOpen,
  CalendarDays,
  FileText,
  Megaphone,
  Music,
  Plus,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface AddMenuModalProps {
  /** Show Bible Verse option */
  showBibleVerse?: boolean
  /** Show Bible Passage option */
  showBiblePassage?: boolean
  /** Show Import Schedule option */
  showImportSchedule?: boolean
  /** Callback when song is selected */
  onAddSong: () => void
  /** Callback when Bible verse is selected */
  onAddBibleVerse?: () => void
  /** Callback when Bible passage is selected */
  onAddBiblePassage?: () => void
  /** Callback when announcement slide is selected */
  onAddAnnouncement: () => void
  /** Callback when versete tineri slide is selected */
  onAddVerseteTineri: () => void
  /** Callback when import schedule is selected */
  onImportSchedule?: () => void
}

export function AddMenuModal({
  showBibleVerse = false,
  showBiblePassage = false,
  showImportSchedule = false,
  onAddSong,
  onAddBibleVerse,
  onAddBiblePassage,
  onAddAnnouncement,
  onAddVerseteTineri,
  onImportSchedule,
}: AddMenuModalProps) {
  const { t } = useTranslation('queue')
  const [isOpen, setIsOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
    }
  }, [isOpen])

  const handleAction = (action: () => void) => {
    setIsOpen(false)
    action()
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-lg transition-colors"
      >
        <Plus size={16} />
        {t('addToQueue.button')}
      </button>

      <dialog
        ref={dialogRef}
        onCancel={handleClose}
        onClick={(e) => {
          if (e.target === dialogRef.current) handleClose()
        }}
        className="fixed inset-0 m-auto w-full max-w-sm p-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl backdrop:bg-black/50"
      >
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('addToQueue.title')}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Options */}
          <div className="p-4 space-y-2">
            {/* Song */}
            <button
              type="button"
              onClick={() => handleAction(onAddSong)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Music
                  size={20}
                  className="text-indigo-600 dark:text-indigo-400"
                />
              </div>
              <div>
                <div className="font-medium">{t('addToQueue.searchSong')}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {t('addToQueue.searchSongDescription')}
                </div>
              </div>
            </button>

            {/* Bible Verse */}
            {showBibleVerse && onAddBibleVerse && (
              <button
                type="button"
                onClick={() => handleAction(onAddBibleVerse)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Book
                    size={20}
                    className="text-blue-600 dark:text-blue-400"
                  />
                </div>
                <div>
                  <div className="font-medium">
                    {t('addToQueue.bibleVerse')}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {t('addToQueue.bibleVerseDescription')}
                  </div>
                </div>
              </button>
            )}

            {/* Bible Passage */}
            {showBiblePassage && onAddBiblePassage && (
              <button
                type="button"
                onClick={() => handleAction(onAddBiblePassage)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                  <BookOpen
                    size={20}
                    className="text-teal-600 dark:text-teal-400"
                  />
                </div>
                <div>
                  <div className="font-medium">
                    {t('addToQueue.biblePassage')}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {t('addToQueue.biblePassageDescription')}
                  </div>
                </div>
              </button>
            )}

            {/* Announcement */}
            <button
              type="button"
              onClick={() => handleAction(onAddAnnouncement)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Megaphone
                  size={20}
                  className="text-orange-600 dark:text-orange-400"
                />
              </div>
              <div>
                <div className="font-medium">
                  {t('addToQueue.announcement')}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {t('addToQueue.announcementDescription')}
                </div>
              </div>
            </button>

            {/* Versete Tineri */}
            <button
              type="button"
              onClick={() => handleAction(onAddVerseteTineri)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <FileText
                  size={20}
                  className="text-green-600 dark:text-green-400"
                />
              </div>
              <div>
                <div className="font-medium">
                  {t('addToQueue.verseteTineri')}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {t('addToQueue.verseteTineriDescription')}
                </div>
              </div>
            </button>

            {/* Import Schedule */}
            {showImportSchedule && onImportSchedule && (
              <button
                type="button"
                onClick={() => handleAction(onImportSchedule)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <CalendarDays
                    size={20}
                    className="text-purple-600 dark:text-purple-400"
                  />
                </div>
                <div>
                  <div className="font-medium">{t('importSchedule.title')}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {t('importSchedule.description')}
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      </dialog>
    </>
  )
}
