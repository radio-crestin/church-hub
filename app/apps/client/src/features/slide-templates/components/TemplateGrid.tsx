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
      className={`relative flex min-w-0 flex-col gap-1.5 rounded-lg border border-line p-2 text-left transition-colors disabled:opacity-60 ${
        selected ? 'bg-selected' : 'hover:bg-hover'
      }`}
    >
      {children}
      <span className="truncate text-sm font-medium text-fg">{label}</span>
      {detail && <span className="-mt-1 text-xs text-fg-hint">{detail}</span>}
      {selected && (
        <Check
          size={20}
          strokeWidth={2}
          className="absolute top-3 right-3 rounded-full bg-panel p-0.5 text-fg"
        />
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
          <span className="flex aspect-video items-center justify-center rounded-md bg-field">
            <LayoutTemplate
              size={24}
              strokeWidth={1.5}
              className="text-fg-hint"
            />
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
