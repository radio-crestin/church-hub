import { FileText, Megaphone, Music, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { SlideTemplate } from '../types'

interface AddToQueueMenuProps {
  onAddSong: () => void
  onAddSlide: (template: SlideTemplate) => void
}

export function AddToQueueMenu({ onAddSong, onAddSlide }: AddToQueueMenuProps) {
  const { t } = useTranslation('queue')
  const [isOpen, setIsOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Dialog open/close handling
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
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-md transition-colors"
      >
        <Plus size={14} />
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

            <button
              type="button"
              onClick={() => handleAction(() => onAddSlide('announcement'))}
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

            <button
              type="button"
              onClick={() => handleAction(() => onAddSlide('versete_tineri'))}
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
          </div>
        </div>
      </dialog>
    </>
  )
}
