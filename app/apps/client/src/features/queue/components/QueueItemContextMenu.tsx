import { Edit3, MoreVertical, PlusCircle, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface QueueItemContextMenuProps {
  onEditSong?: () => void
  onInsertSlideAfter: () => void
  onRemove: () => void
}

export function QueueItemContextMenu({
  onEditSong,
  onInsertSlideAfter,
  onRemove,
}: QueueItemContextMenuProps) {
  const { t } = useTranslation('queue')
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

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
          <button
            type="button"
            onClick={() => handleAction(onInsertSlideAfter)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <PlusCircle size={14} />
            {t('actions.insertSlide')}
          </button>
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
}
