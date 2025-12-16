import {
  CalendarPlus,
  Edit3,
  FileText,
  Megaphone,
  MoreVertical,
  Music,
  PlusCircle,
  Trash2,
  X,
} from 'lucide-react'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import type { SlideTemplate } from '../types'

export interface QueueItemContextMenuHandle {
  openMenu: () => void
}

interface QueueItemContextMenuProps {
  onEditSong?: () => void
  onEditSlide?: () => void
  onAddToSchedule?: () => void
  onInsertSongAfter: () => void
  onInsertSlideAfter: (template: SlideTemplate) => void
  onRemove: () => void
}

export const QueueItemContextMenu = forwardRef<
  QueueItemContextMenuHandle,
  QueueItemContextMenuProps
>(function QueueItemContextMenu(
  { onEditSong, onEditSlide, onAddToSchedule, onInsertSongAfter, onInsertSlideAfter, onRemove },
  ref,
) {
  const { t } = useTranslation('queue')
  const [isOpen, setIsOpen] = useState(false)
  const [showInsertDialog, setShowInsertDialog] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Expose openMenu to parent via ref
  useImperativeHandle(ref, () => ({
    openMenu: () => setIsOpen(true),
  }))

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Close menu on Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Dialog open/close handling
  useEffect(() => {
    if (showInsertDialog) {
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
    }
  }, [showInsertDialog])

  const handleAction = (action: () => void) => {
    setIsOpen(false)
    action()
  }

  const handleInsertAfterClick = () => {
    setIsOpen(false)
    setShowInsertDialog(true)
  }

  const handleDialogAction = (action: () => void) => {
    setShowInsertDialog(false)
    action()
  }

  const handleDialogClose = () => {
    setShowInsertDialog(false)
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex-shrink-0 p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title={t('actions.moreOptions')}
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1"
        >
          {onEditSong && (
            <button
              type="button"
              onClick={() => handleAction(onEditSong)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Edit3 size={14} />
              {t('actions.editSong')}
            </button>
          )}
          {onEditSlide && (
            <button
              type="button"
              onClick={() => handleAction(onEditSlide)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Edit3 size={14} />
              {t('actions.editSlide')}
            </button>
          )}
          {onAddToSchedule && (
            <button
              type="button"
              onClick={() => handleAction(onAddToSchedule)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <CalendarPlus size={14} />
              {t('actions.addToSchedule')}
            </button>
          )}
          {/* Insert After - opens dialog */}
          <button
            type="button"
            onClick={handleInsertAfterClick}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <PlusCircle size={14} />
            {t('actions.insertAfter')}
          </button>
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
          <button
            type="button"
            onClick={() => handleAction(onRemove)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 size={14} />
            {t('actions.remove')}
          </button>
        </div>
      )}

      {/* Insert After Dialog */}
      <dialog
        ref={dialogRef}
        onCancel={handleDialogClose}
        onClick={(e) => {
          if (e.target === dialogRef.current) handleDialogClose()
        }}
        className="fixed inset-0 m-auto w-full max-w-sm p-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl backdrop:bg-black/50"
      >
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('actions.insertAfter')}
            </h2>
            <button
              type="button"
              onClick={handleDialogClose}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Options */}
          <div className="p-4 space-y-2">
            <button
              type="button"
              onClick={() => handleDialogAction(onInsertSongAfter)}
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
              onClick={() =>
                handleDialogAction(() => onInsertSlideAfter('announcement'))
              }
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
              onClick={() =>
                handleDialogAction(() => onInsertSlideAfter('versete_tineri'))
              }
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
    </div>
  )
})
