import { Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SongTag } from '../../types'

interface TagCardProps {
  tag: SongTag
  onEdit: () => void
  onDelete: () => void
}

export function TagCard({ tag, onEdit, onDelete }: TagCardProps) {
  const { t } = useTranslation('settings')

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-hover">
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-fg truncate block">
          {tag.name}
        </span>
        <span className="text-xs text-fg-hint">
          {t('sections.tags.songCount', { count: tag.songCount })}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="p-2 text-fg-hint hover:text-fg transition-colors"
          title={t('sections.tags.actions.edit')}
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-2 text-fg-hint hover:text-red-600 dark:hover:text-red-400 transition-colors"
          title={t('sections.tags.actions.delete')}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}
