import { Download, FileText, Presentation, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export type ExportFormat = 'opensong' | 'pptx'

interface ExportFormatModalProps {
  isOpen: boolean
  onConfirm: (format: ExportFormat) => void
  onCancel: () => void
}

export function ExportFormatModal({
  isOpen,
  onConfirm,
  onCancel,
}: ExportFormatModalProps) {
  const { t } = useTranslation('songs')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('opensong')

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
      setSelectedFormat('opensong')
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
      className="fixed inset-0 m-auto p-0 rounded-xl shadow-popover backdrop:bg-black/50 bg-panel"
      onClose={onCancel}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="p-6 min-w-[400px] max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-fg-label" />
            <h2 className="text-base font-semibold text-fg">
              {t('export.formatTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <p className="text-fg-label mb-6">{t('export.formatDescription')}</p>

        <div className="space-y-3 mb-6">
          <label
            className={`flex items-start gap-4 p-4 cursor-pointer rounded-lg border-2 transition-colors ${
              selectedFormat === 'opensong'
                ? 'border-line-strong bg-selected'
                : 'border-line hover:bg-hover'
            }`}
          >
            <input
              type="radio"
              name="exportFormat"
              checked={selectedFormat === 'opensong'}
              onChange={() => setSelectedFormat('opensong')}
              className="mt-1 w-4 h-4 text-primary bg-field border-line focus:ring-focus"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-5 h-5 text-fg-label" />
                <span className="font-medium text-fg">
                  {t('export.formats.opensong.name')}
                </span>
              </div>
              <p className="text-sm text-fg-label">
                {t('export.formats.opensong.description')}
              </p>
            </div>
          </label>

          <label
            className={`flex items-start gap-4 p-4 cursor-pointer rounded-lg border-2 transition-colors ${
              selectedFormat === 'pptx'
                ? 'border-line-strong bg-selected'
                : 'border-line hover:bg-hover'
            }`}
          >
            <input
              type="radio"
              name="exportFormat"
              checked={selectedFormat === 'pptx'}
              onChange={() => setSelectedFormat('pptx')}
              className="mt-1 w-4 h-4 text-primary bg-field border-line focus:ring-focus"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Presentation className="w-5 h-5 text-fg-label" />
                <span className="font-medium text-fg">
                  {t('export.formats.pptx.name')}
                </span>
              </div>
              <p className="text-sm text-fg-label">
                {t('export.formats.pptx.description')}
              </p>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-3.5 text-[13px] font-medium bg-field text-fg hover:bg-hover rounded-lg transition-colors"
          >
            {t('modal.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="h-9 px-3.5 text-[13px] font-medium bg-primary hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            {t('export.confirmButton')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
