import { ChevronDown, LayoutTemplate } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TemplatePickerDialog } from './TemplatePickerDialog'
import { TemplateThumbnail } from './TemplateThumbnail'
import { useSlideTemplate, useSlideTemplates } from '../hooks/useSlideTemplates'
import { templateDisplayName } from '../utils/templateDisplayName'

interface TemplatePickerProps {
  /** The chosen template, or null for `noneLabel`. */
  value: number | null
  onChange: (templateId: number | null) => void
  /** Offered first when given: "no template of its own" (e.g. the screen's). */
  noneLabel?: string
  disabled?: boolean
  /**
   * `card`: the thumbnail and name, full width (settings). `compact`: a small
   * thumbnail and name (a page header). `chip`: an icon, plus the name once
   * one is chosen (beside a list item).
   */
  variant?: 'card' | 'compact' | 'chip'
  testId?: string
}

const TRIGGER_CLASS = {
  card: 'flex w-full items-center gap-3 rounded-lg bg-field p-2 text-left text-[13px] font-medium text-fg transition-colors hover:bg-hover disabled:opacity-50',
  compact:
    'flex max-w-56 items-center gap-2 rounded-lg bg-field py-1 pr-2 pl-1 text-left text-[13px] text-fg transition-colors hover:bg-hover disabled:opacity-50',
  chip: 'flex max-w-40 items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs text-fg-hint transition-colors hover:bg-hover hover:text-fg-body disabled:opacity-50',
}

const THUMB_WIDTH = { card: 'w-24', compact: 'w-12', chip: '' }

/**
 * Choosing a template is one choice: the current one shows with its
 * thumbnail, and a click opens every template drawn as it looks.
 */
export function TemplatePicker({
  value,
  onChange,
  noneLabel,
  disabled = false,
  variant = 'card',
  testId = 'template-picker',
}: TemplatePickerProps) {
  const { t } = useTranslation('presentation')
  const { data: templates = [] } = useSlideTemplates()
  const [open, setOpen] = useState(false)
  const listed = templates.find((template) => template.id === value)
  // A presentation's own theme isn't among the shared ones: read it by id.
  const { data: own } = useSlideTemplate(listed ? null : value)
  const current = listed ?? own ?? null

  return (
    <>
      <button
        type="button"
        data-testid={testId}
        disabled={disabled}
        onClick={() => setOpen(true)}
        title={t('templates.picker.change')}
        className={TRIGGER_CLASS[variant]}
      >
        {variant === 'chip' ? (
          <LayoutTemplate
            size={16}
            strokeWidth={1.5}
            className={`flex-none ${current ? 'text-fg' : ''}`}
          />
        ) : current ? (
          <TemplateThumbnail
            template={current}
            className={`${THUMB_WIDTH[variant]} flex-none`}
          />
        ) : (
          <span
            className={`flex aspect-video ${THUMB_WIDTH[variant]} flex-none items-center justify-center rounded-md bg-panel`}
          >
            <LayoutTemplate
              size={16}
              strokeWidth={1.5}
              className="text-fg-hint"
            />
          </span>
        )}
        {(variant !== 'chip' || current) && (
          <span
            data-testid={`${testId}-value`}
            className="min-w-0 flex-1 truncate"
          >
            {current ? templateDisplayName(current, t) : noneLabel}
          </span>
        )}
        {variant !== 'chip' && (
          <ChevronDown
            size={16}
            strokeWidth={1.5}
            className="flex-none text-fg-label"
          />
        )}
      </button>

      <TemplatePickerDialog
        open={open}
        onClose={() => setOpen(false)}
        value={value}
        onChange={onChange}
        noneLabel={noneLabel}
        testId={testId}
      />
    </>
  )
}
