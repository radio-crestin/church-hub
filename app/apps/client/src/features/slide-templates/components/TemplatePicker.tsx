import { ChevronDown, LayoutTemplate } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { HeaderIconButton } from '~/ui/button'
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
   * one is chosen (beside a list item). `icon`: the icon alone, the name in
   * its tooltip (a panel header); with `thumbnail`, the chosen one's small
   * thumbnail instead of the icon (a row of a long list).
   */
  variant?: 'card' | 'compact' | 'chip' | 'icon'
  /** `icon` only: show the chosen template's thumbnail instead of the icon. */
  thumbnail?: boolean
  testId?: string
}

const TRIGGER_CLASS = {
  card: 'flex w-full items-center gap-3 rounded-lg bg-field p-2 text-left text-sm font-medium text-fg transition-colors hover:bg-hover disabled:opacity-50',
  compact:
    'flex h-8 max-w-56 items-center gap-2 rounded-lg bg-raised py-1 pr-2 pl-1 text-left text-sm font-medium text-fg shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-hover disabled:opacity-50',
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
  thumbnail = false,
  testId = 'template-picker',
}: TemplatePickerProps) {
  const { t } = useTranslation('presentation')
  const { data: templates = [] } = useSlideTemplates()
  const [open, setOpen] = useState(false)
  const listed = templates.find((template) => template.id === value)
  // A presentation's own theme isn't among the shared ones: read it by id.
  const { data: own } = useSlideTemplate(listed ? null : value)
  const current = listed ?? own ?? null
  const currentName = current ? templateDisplayName(current, t) : noneLabel

  const dialog = (
    <TemplatePickerDialog
      open={open}
      onClose={() => setOpen(false)}
      value={value}
      onChange={onChange}
      noneLabel={noneLabel}
      testId={testId}
    />
  )

  if (variant === 'icon') {
    const label = currentName
      ? t('templates.picker.current', { name: currentName })
      : t('templates.picker.change')
    return (
      <>
        <HeaderIconButton
          label={label}
          data-testid={testId}
          data-value={value ?? undefined}
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          {thumbnail && current ? (
            <TemplateThumbnail template={current} className="w-8 flex-none" />
          ) : (
            <LayoutTemplate size={16} strokeWidth={1.5} />
          )}
        </HeaderIconButton>
        {dialog}
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        data-testid={testId}
        disabled={disabled}
        onClick={() => setOpen(true)}
        data-value={value ?? undefined}
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
            className={`flex aspect-video ${THUMB_WIDTH[variant]} flex-none items-center justify-center rounded-md shadow-[inset_0_0_0_1px_var(--color-line-strong)]`}
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
            {currentName}
          </span>
        )}
        {(variant === 'card' || variant === 'compact') && (
          <ChevronDown
            size={16}
            strokeWidth={1.5}
            className="flex-none text-fg-label"
          />
        )}
      </button>

      {dialog}
    </>
  )
}
