import { CopyPlus, Edit, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button/Button'
import { TemplateThumbnail } from './TemplateThumbnail'
import type { SlideTemplateWithUsage } from '../types'
import { templateDisplayName } from '../utils/templateDisplayName'
import { usageNames } from '../utils/usageNames'

interface TemplateCardProps {
  template: SlideTemplateWithUsage
  onEdit: () => void
  onDuplicate: () => void
  onRename: () => void
  onDelete: () => void
}

/** One template on the Templates page: how it looks, who uses it, its actions. */
export function TemplateCard({
  template,
  onEdit,
  onDuplicate,
  onRename,
  onDelete,
}: TemplateCardProps) {
  const { t } = useTranslation('presentation')
  const bundled = !!template.bundledKey
  const users = usageNames(template.usage)

  return (
    <div
      data-testid="template-card"
      data-template-id={template.id}
      className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
    >
      <button
        type="button"
        onClick={onEdit}
        title={t('templates.actions.edit')}
        className="rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <TemplateThumbnail template={template} />
      </button>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3
            data-testid="template-card-name"
            className="truncate font-medium text-gray-900 dark:text-white"
          >
            {templateDisplayName(template, t)}
          </h3>
          {bundled && (
            <span className="flex-none rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {t('templates.bundledBadge')}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
          {users
            ? t('templates.usedBy', { names: users })
            : t('templates.unused')}
        </p>
      </div>
      <div className="mt-auto flex flex-wrap gap-1">
        <Button variant="secondary" size="sm" onClick={onEdit}>
          <Edit size={14} />
          <span className="ml-1">{t('templates.actions.edit')}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDuplicate}
          title={t('templates.actions.duplicate')}
          aria-label={t('templates.actions.duplicate')}
        >
          <CopyPlus size={14} />
        </Button>
        {!bundled && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRename}
              title={t('templates.actions.rename')}
              aria-label={t('templates.actions.rename')}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              title={t('templates.actions.delete')}
              aria-label={t('templates.actions.delete')}
              className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
            >
              <Trash2 size={14} />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
