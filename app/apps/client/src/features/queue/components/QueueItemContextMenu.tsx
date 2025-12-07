import {
  ChevronRight,
  Edit3,
  FileText,
  Megaphone,
  MoreVertical,
  Music,
  PlusCircle,
  Trash2,
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
  onInsertSongAfter: () => void
  onInsertSlideAfter: (template: SlideTemplate) => void
  onRemove: () => void
}

export const QueueItemContextMenu = forwardRef<
  QueueItemContextMenuHandle,
  QueueItemContextMenuProps
>(function QueueItemContextMenu(
  { onEditSong, onEditSlide, onInsertSongAfter, onInsertSlideAfter, onRemove },
  ref,
) {
  const { t } = useTranslation('queue')
  const [isOpen, setIsOpen] = useState(false)
  const [showInsertSubmenu, setShowInsertSubmenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

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

  const handleAction = (action: () => void) => {
    setIsOpen(false)
    action()
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
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Edit3 size={14} />
              {t('actions.editSong')}
            </button>
          )}
          {onEditSlide && (
            <button
              type="button"
              onClick={() => handleAction(onEditSlide)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Edit3 size={14} />
              {t('actions.editSlide')}
            </button>
          )}
          {/* Insert After with submenu */}
          <div
            className="relative"
            onMouseEnter={() => setShowInsertSubmenu(true)}
            onMouseLeave={() => setShowInsertSubmenu(false)}
          >
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <span className="flex items-center gap-2">
                <PlusCircle size={14} />
                {t('actions.insertAfter')}
              </span>
              <ChevronRight size={14} />
            </button>
            {showInsertSubmenu && (
              <div className="absolute left-full top-0 ml-1 min-w-[160px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1">
                <button
                  type="button"
                  onClick={() => handleAction(onInsertSongAfter)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Music size={14} />
                  {t('addToQueue.searchSong')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAction(() => onInsertSlideAfter('announcement'))
                  }
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Megaphone size={14} />
                  {t('addToQueue.announcement')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAction(() => onInsertSlideAfter('versete_tineri'))
                  }
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <FileText size={14} />
                  {t('addToQueue.verseteTineri')}
                </button>
              </div>
            )}
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
          <button
            type="button"
            onClick={() => handleAction(onRemove)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 size={14} />
            {t('actions.remove')}
          </button>
        </div>
      )}
    </div>
  )
})
