import { Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SongCategory } from '../../types'

interface CategoryCardProps {
  category: SongCategory
  onEdit: () => void
  onDelete: () => void
}

export function CategoryCard({
  category,
  onEdit,
  onDelete,
}: CategoryCardProps) {
  const { t } = useTranslation('settings')

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate block">
          {category.name}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {t('sections.categories.songCount', { count: category.songCount })}
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
