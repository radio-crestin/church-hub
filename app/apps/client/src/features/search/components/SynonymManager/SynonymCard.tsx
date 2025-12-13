import { ArrowLeftRight, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SynonymGroup } from '~/service/synonyms'

interface SynonymCardProps {
  synonym: SynonymGroup
  onEdit: () => void
  onDelete: () => void
}

export function SynonymCard({ synonym, onEdit, onDelete }: SynonymCardProps) {
  const { t } = useTranslation('settings')

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {synonym.primary}
          </span>
          <ArrowLeftRight
            size={14}
            className="text-gray-400 dark:text-gray-500 shrink-0"
          />
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {synonym.synonyms.join(', ')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="p-2 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          title={t('sections.synonyms.actions.edit')}
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          title={t('sections.synonyms.actions.delete')}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}
