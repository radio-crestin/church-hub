import { Check, LayoutTemplate } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { TemplateThumbnail } from './TemplateThumbnail'
import { useSlideTemplates } from '../hooks/useSlideTemplates'
import { templateDisplayName } from '../utils/templateDisplayName'

interface TemplateGridProps {
  /** The chosen template, or null for `noneLabel`. */
  value: number | null
  onChoose: (templateId: number | null) => void
  /** Offered first when given: "no template of its own" (e.g. the screen's). */
  noneLabel?: string
  disabled?: boolean
  /** Fewer, smaller columns, for a settings panel. */
  dense?: boolean
}

function Choice({
  selected,
  label,
  detail,
  onClick,
  disabled,
  children,
  testId,
}: {
  selected: boolean
  label: string
  detail?: string
  onClick: () => void
  disabled: boolean
  children: React.ReactNode
  testId: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      aria-pressed={selected}
      className={`relative flex min-w-0 flex-col gap-1.5 rounded-lg border-2 p-2 text-left transition-colors disabled:opacity-60 ${
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-500/30'
          : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
      }`}
    >
      {children}
      <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
        {label}
      </span>
      {detail && (
        <span className="-mt-1 text-xs text-gray-500 dark:text-gray-400">
          {detail}
        </span>
      )}
      {selected && (
        <Check className="absolute top-3 right-3 h-5 w-5 rounded-full bg-indigo-600 p-0.5 text-white" />
      )}
    </button>
  )
}

/** Every template drawn as it looks; a click chooses one. */
export function TemplateGrid({
  value,
  onChoose,
  noneLabel,
  disabled = false,
  dense = false,
}: TemplateGridProps) {
  const { t } = useTranslation('presentation')
  const { data: templates = [] } = useSlideTemplates()

  return (
    <div
      className={`grid gap-3 ${
        dense
          ? 'grid-cols-2 sm:grid-cols-3'
          : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
      }`}
    >
      {noneLabel && (
        <Choice
          selected={value === null}
          label={noneLabel}
          onClick={() => onChoose(null)}
          disabled={disabled}
          testId="template-choice-none"
        >
          <span className="flex aspect-video items-center justify-center rounded-md bg-gray-100 dark:bg-gray-900">
            <LayoutTemplate className="h-6 w-6 text-gray-400" />
          </span>
        </Choice>
      )}
      {templates.map((template) => (
        <Choice
          key={template.id}
          selected={template.id === value}
          label={templateDisplayName(template, t)}
          detail={template.bundledKey ? t('templates.bundledBadge') : undefined}
          onClick={() => onChoose(template.id)}
          disabled={disabled}
          testId={`template-choice-${template.id}`}
        >
          <TemplateThumbnail template={template} />
        </Choice>
      ))}
    </div>
  )
}
