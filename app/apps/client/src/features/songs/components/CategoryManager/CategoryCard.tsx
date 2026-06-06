import { Eye, EyeOff, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SongCategory } from '../../types'

interface CategoryCardProps {
  category: SongCategory
  onEdit: () => void
  onDelete: () => void
  onToggleHidden: () => void
}

export function CategoryCard({
  category,
  onEdit,
  onDelete,
  onToggleHidden,
}: CategoryCardProps) {
  const { t } = useTranslation('settings')
  const isHidden = category.isHidden === 1

  return (
    <div
      className={`flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${
        isHidden ? 'opacity-60' : ''
      }`}
    >
      <div className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {category.name}
          </span>
          {isHidden && (
            <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {t('sections.categories.hiddenBadge')}
            </span>
          )}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {t('sections.categories.songCount', { count: category.songCount })}
          {' · '}
          {t('sections.categories.value')}: {category.priority}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleHidden}
          className="p-2 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          title={
            isHidden
              ? t('sections.categories.actions.show')
              : t('sections.categories.actions.hide')
          }
        >
          {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
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
