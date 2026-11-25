import { Link } from '@tanstack/react-router'
import { Check, ChevronDown, LayoutTemplate, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TemplateThumbnail } from './TemplateThumbnail'
import { useSlideTemplates } from '../hooks/useSlideTemplates'
import type { SlideTemplate } from '../types'
import { templateDisplayName } from '../utils/templateDisplayName'

interface TemplatePickerProps {
  /** The chosen template, or null for `noneLabel`. */
  value: number | null
  onChange: (templateId: number | null) => void
  /** Offered first when given: "no template of its own" (e.g. the screen's). */
  noneLabel?: string
  disabled?: boolean
  testId?: string
}

function Choice({
  selected,
  label,
  detail,
  onClick,
  children,
  testId,
}: {
  selected: boolean
  label: string
  detail?: string
  onClick: () => void
  children: React.ReactNode
  testId: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-pressed={selected}
      className={`relative flex flex-col gap-1.5 rounded-lg border-2 p-2 text-left transition-colors ${
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

/**
 * Choosing a template is one choice: the current one shows with its
 * thumbnail, and a click opens every template drawn as it looks.
 */
export function TemplatePicker({
  value,
  onChange,
  noneLabel,
  disabled = false,
  testId = 'template-picker',
}: TemplatePickerProps) {
  const { t } = useTranslation('presentation')
  const { data: templates = [] } = useSlideTemplates()
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const current = templates.find((template) => template.id === value) ?? null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const choose = (templateId: number | null) => {
    setOpen(false)
    if (templateId !== value) onChange(templateId)
  }
  const detail = (template: SlideTemplate) =>
    template.bundledKey ? t('templates.bundledBadge') : undefined

  return (
    <>
      <button
        type="button"
        data-testid={testId}
        disabled={disabled}
        onClick={() => setOpen(true)}
        title={t('templates.picker.change')}
        className="flex w-full items-center gap-3 rounded-lg border border-gray-300 bg-white p-2 text-left hover:border-indigo-400 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900"
      >
        {current ? (
          <TemplateThumbnail template={current} className="w-24 flex-none" />
        ) : (
          <span className="flex aspect-video w-24 flex-none items-center justify-center rounded-md bg-gray-100 dark:bg-gray-800">
            <LayoutTemplate className="h-5 w-5 text-gray-400" />
          </span>
        )}
        <span
          data-testid={`${testId}-value`}
          className="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-white"
        >
          {current ? templateDisplayName(current, t) : noneLabel}
        </span>
        <ChevronDown className="h-4 w-4 flex-none text-gray-500" />
      </button>

      <dialog
        ref={dialogRef}
        data-testid={`${testId}-dialog`}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false)
        }}
        className="fixed inset-0 m-auto w-[min(56rem,95vw)] rounded-xl bg-white p-0 shadow-xl backdrop:bg-black/50 dark:bg-gray-800"
      >
        {open && (
          <div className="flex max-h-[85vh] flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('templates.picker.title')}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('templates.picker.close')}
                className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 overflow-y-auto p-5 sm:grid-cols-3 lg:grid-cols-4">
              {noneLabel && (
                <Choice
                  selected={value === null}
                  label={noneLabel}
                  onClick={() => choose(null)}
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
                  detail={detail(template)}
                  onClick={() => choose(template.id)}
                  testId={`template-choice-${template.id}`}
                >
                  <TemplateThumbnail template={template} />
                </Choice>
              ))}
            </div>
            <div className="border-t border-gray-200 px-5 py-3 text-right dark:border-gray-700">
              <Link
                to="/settings/templates"
                className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {t('templates.picker.manage')}
              </Link>
            </div>
          </div>
        )}
      </dialog>
    </>
  )
}
