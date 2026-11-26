import { Link } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { TemplateGrid } from './TemplateGrid'

interface TemplatePickerDialogProps {
  open: boolean
  onClose: () => void
  /** The chosen template, or null for `noneLabel`. */
  value: number | null
  onChange: (templateId: number | null) => void
  /** Offered first when given: "no template of its own" (e.g. the screen's). */
  noneLabel?: string
  testId?: string
}

/** Every template drawn as it looks; a click chooses one and closes. */
export function TemplatePickerDialog({
  open,
  onClose,
  value,
  onChange,
  noneLabel,
  testId = 'template-picker',
}: TemplatePickerDialogProps) {
  const { t } = useTranslation('presentation')
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const choose = (templateId: number | null) => {
    onClose()
    if (templateId !== value) onChange(templateId)
  }

  return (
    <dialog
      ref={dialogRef}
      data-testid={`${testId}-dialog`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
      className="fixed inset-0 m-auto w-[min(56rem,95vw)] rounded-xl border border-line bg-panel p-0 shadow-popover backdrop:bg-black/50"
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-base font-semibold text-fg">
              {t('templates.picker.title')}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('templates.picker.close')}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-label transition-colors hover:bg-hover hover:text-fg"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
          <div className="overflow-y-auto p-5">
            <TemplateGrid
              value={value}
              onChoose={choose}
              noneLabel={noneLabel}
            />
          </div>
          <div className="border-t border-line px-5 py-3 text-right">
            <Link
              to="/settings/themes"
              className="text-sm font-medium text-focus hover:underline"
            >
              {t('templates.picker.manage')}
            </Link>
          </div>
        </div>
      )}
    </dialog>
  )
}
