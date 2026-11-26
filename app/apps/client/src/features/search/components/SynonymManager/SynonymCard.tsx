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
    <div className="flex items-center gap-3 p-3 bg-field rounded-lg border border-line">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-fg">{synonym.primary}</span>
          <ArrowLeftRight
            size={14}
            className="text-fg-hint shrink-0"
            strokeWidth={1.75}
          />
          <span className="text-sm text-fg-label">
            {synonym.synonyms.join(', ')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="p-2 text-fg-hint hover:text-fg transition-colors"
          title={t('sections.synonyms.actions.edit')}
        >
          <Pencil size={16} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-2 text-fg-hint hover:text-red-600 dark:hover:text-red-400 transition-colors"
          title={t('sections.synonyms.actions.delete')}
        >
          <Trash2 size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
