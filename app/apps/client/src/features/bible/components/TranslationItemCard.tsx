import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Book, GripVertical, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { BibleTranslation } from '../types'

interface TranslationItemCardProps {
  translation: BibleTranslation
  index: number
  onRemove: () => void
}

export function TranslationItemCard({
  translation,
  index,
  onRemove,
}: TranslationItemCardProps) {
  const { t } = useTranslation('settings')

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: translation.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const getOrderLabel = (idx: number) => {
    switch (idx) {
      case 0:
        return t('sections.bible.primary')
      case 1:
        return t('sections.bible.secondary')
      case 2:
        return t('sections.bible.tertiary')
      default:
        return ''
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-3 p-3 bg-panel
        border border-line rounded-lg
        ${isDragging ? 'ring-1 ring-line-strong' : ''}
      `}
    >
      {/* Drag Handle */}
      <button
        type="button"
        className="p-1 text-fg-hint hover:text-fg-label cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={20} strokeWidth={1.5} />
      </button>

      {/* Icon */}
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-fg-label">
        <Book size={18} />
      </div>

      {/* Translation Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-fg truncate">
            {translation.name}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-field text-fg-label">
            {translation.abbreviation}
          </span>
        </div>
        <span className="text-xs text-fg">{getOrderLabel(index)}</span>
      </div>

      {/* Remove Button */}
      <button
        type="button"
        onClick={onRemove}
        className="p-2 text-fg-hint hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        title={t('common:buttons.remove')}
      >
        <X size={18} />
      </button>
    </div>
  )
}
