import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SongCategory } from '../../types'

interface CategoryCardProps {
  category: SongCategory
  index: number
  onEdit: () => void
  onDelete: () => void
}

export function CategoryCard({
  category,
  index,
  onEdit,
  onDelete,
}: CategoryCardProps) {
  const { t } = useTranslation('settings')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${
        isDragging ? 'shadow-lg ring-2 ring-indigo-500' : ''
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <GripVertical size={20} />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {category.name}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            #{index + 1}
          </span>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {t('sections.categories.priority')}: {category.priority}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="p-2 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          title={t('sections.categories.actions.edit')}
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          title={t('sections.categories.actions.delete')}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}
