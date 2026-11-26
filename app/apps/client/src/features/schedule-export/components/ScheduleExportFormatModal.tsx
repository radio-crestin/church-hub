import { Archive, Download, FileText, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ScheduleExportFormat } from '../types'

interface ScheduleExportFormatModalProps {
  isOpen: boolean
  onConfirm: (format: ScheduleExportFormat) => void
  onCancel: () => void
}

export function ScheduleExportFormatModal({
  isOpen,
  onConfirm,
  onCancel,
}: ScheduleExportFormatModalProps) {
  const { t } = useTranslation('schedules')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const [selectedFormat, setSelectedFormat] =
    useState<ScheduleExportFormat>('churchprogram')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setSelectedFormat('churchprogram')
    }
  }, [isOpen])

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (
      e.target === dialogRef.current &&
      mouseDownTargetRef.current === dialogRef.current
    ) {
      onCancel()
    }
  }

  const handleConfirm = () => {
    onConfirm(selectedFormat)
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-lg shadow-xl backdrop:bg-black/50 bg-panel"
      onClose={onCancel}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="p-6 min-w-[400px] max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-fg" strokeWidth={1.5} />
            <h2 className="text-base font-semibold text-fg">
              {t('export.formatTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-fg-hint hover:text-fg-label rounded transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        <p className="text-fg-label mb-6">{t('export.formatDescription')}</p>

        <div className="space-y-3 mb-6">
          <label
            className={`flex items-start gap-4 p-4 cursor-pointer rounded-lg border-2 transition-colors ${
              selectedFormat === 'churchprogram'
                ? 'border-line-strong bg-selected'
                : 'border-line'
            }`}
          >
            <input
              type="radio"
              name="scheduleExportFormat"
              checked={selectedFormat === 'churchprogram'}
              onChange={() => setSelectedFormat('churchprogram')}
              className="mt-1 w-4 h-4 text-fg bg-field border-line focus:ring-focus"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-5 h-5 text-fg" strokeWidth={1.5} />
                <span className="font-medium text-fg">
                  {t('export.formats.churchprogram.name')}
                </span>
              </div>
              <p className="text-[13px] text-fg-label">
                {t('export.formats.churchprogram.description')}
              </p>
            </div>
          </label>

          <label
            className={`flex items-start gap-4 p-4 cursor-pointer rounded-lg border-2 transition-colors ${
              selectedFormat === 'pptx'
                ? 'border-line-strong bg-selected'
                : 'border-line'
            }`}
          >
            <input
              type="radio"
              name="scheduleExportFormat"
              checked={selectedFormat === 'pptx'}
              onChange={() => setSelectedFormat('pptx')}
              className="mt-1 w-4 h-4 text-fg bg-field border-line focus:ring-focus"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Archive className="w-5 h-5 text-fg-label" strokeWidth={1.5} />
                <span className="font-medium text-fg">
                  {t('export.formats.pptx.name')}
                </span>
              </div>
              <p className="text-[13px] text-fg-label">
                {t('export.formats.pptx.description')}
              </p>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-3.5 text-[13px] font-medium text-fg-body hover:bg-hover rounded-lg transition-colors"
          >
            {t('modal.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="h-9 px-3.5 text-[13px] bg-primary hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            {t('export.confirmButton')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
