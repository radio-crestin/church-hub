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
  card: 'flex w-full items-center gap-3 rounded-lg border border-gray-300 bg-white p-2 text-left font-medium text-gray-900 hover:border-indigo-400 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white',
  compact:
    'flex max-w-56 items-center gap-2 rounded-lg border border-gray-300 bg-white py-1 pr-2 pl-1 text-left text-sm text-gray-900 hover:border-indigo-400 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white',
  chip: 'flex max-w-40 items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700',
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
            className={`h-4 w-4 flex-none ${current ? 'text-indigo-500' : ''}`}
          />
        ) : current ? (
          <TemplateThumbnail
            template={current}
            className={`${THUMB_WIDTH[variant]} flex-none`}
          />
        ) : (
          <span
            className={`flex aspect-video ${THUMB_WIDTH[variant]} flex-none items-center justify-center rounded-md bg-gray-100 dark:bg-gray-800`}
          >
            <LayoutTemplate className="h-4 w-4 text-gray-400" />
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
          <ChevronDown className="h-4 w-4 flex-none text-gray-500" />
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
