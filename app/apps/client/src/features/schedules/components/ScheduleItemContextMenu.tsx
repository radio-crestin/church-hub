import { AlertTriangle, Edit, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { ScheduleItem } from '../types'

interface ContextMenuPosition {
  x: number
  y: number
}

interface ScheduleItemContextMenuProps {
  item: ScheduleItem
  position: ContextMenuPosition
  onClose: () => void
  onEdit: (item: ScheduleItem) => void
  onDelete: (item: ScheduleItem) => void
  onChangeSong?: (item: ScheduleItem) => void
}

export function ScheduleItemContextMenu({
  item,
  position,
  onClose,
  onEdit,
  onDelete,
  onChangeSong,
}: ScheduleItemContextMenuProps) {
  const { t } = useTranslation('schedules')
  const menuRef = useRef<HTMLDivElement>(null)

  // Check if item has missing content
  const hasMissingContent =
    (item.itemType === 'song' && item.slides.length === 0) ||
    (item.itemType === 'bible_passage' &&
      item.biblePassageVerses.length === 0) ||
    (item.itemType === 'slide' &&
      item.slideType === 'versete_tineri' &&
      item.verseteTineriEntries.length === 0)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // Adjust position if menu would go off screen
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      if (rect.right > viewportWidth) {
        menuRef.current.style.left = `${position.x - rect.width}px`
      }
      if (rect.bottom > viewportHeight) {
        menuRef.current.style.top = `${position.y - rect.height}px`
      }
    }
  }, [position])

  const handleEdit = () => {
    onEdit(item)
    onClose()
  }

  const handleDelete = () => {
    onDelete(item)
    onClose()
  }

  const handleChangeSong = () => {
    if (item.itemType === 'song' && onChangeSong) {
      onChangeSong(item)
      onClose()
    }
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] py-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
      style={{ left: position.x, top: position.y }}
    >
      {/* Warning section for missing content */}
      {hasMissingContent && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle size={14} />
            <span className="text-xs font-medium">
              {t('contextMenu.missingContent')}
            </span>
          </div>
        </div>
      )}

      {/* Edit option */}
      <button
        type="button"
        onClick={handleEdit}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <Edit size={14} />
        {t('contextMenu.edit')}
      </button>

      {/* Change song option - available for all songs */}
      {item.itemType === 'song' && onChangeSong && (
        <button
          type="button"
          onClick={handleChangeSong}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw size={14} />
          {t('contextMenu.changeSong')}
        </button>
      )}

      {/* Delete option */}
      <button
        type="button"
        onClick={handleDelete}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      >
        <Trash2 size={14} />
        {t('contextMenu.delete')}
      </button>
    </div>
  )
}
