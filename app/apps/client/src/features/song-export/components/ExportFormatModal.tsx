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

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onCancel()
    }
  }

  const handleConfirm = () => {
    onConfirm(selectedFormat)
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-lg shadow-xl backdrop:bg-black/50 bg-white dark:bg-gray-800"
      onClose={onCancel}
      onClick={handleBackdropClick}
    >
      <div className="p-6 min-w-[400px] max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('export.formatTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {t('export.formatDescription')}
        </p>

        <div className="space-y-3 mb-6">
          <label
            className={`flex items-start gap-4 p-4 cursor-pointer rounded-lg border-2 transition-colors ${
              selectedFormat === 'opensong'
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <input
              type="radio"
              name="exportFormat"
              checked={selectedFormat === 'opensong'}
              onChange={() => setSelectedFormat('opensong')}
              className="mt-1 w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span className="font-medium text-gray-900 dark:text-white">
                  {t('export.formats.opensong.name')}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('export.formats.opensong.description')}
              </p>
            </div>
          </label>

          <label
            className={`flex items-start gap-4 p-4 cursor-pointer rounded-lg border-2 transition-colors ${
              selectedFormat === 'pptx'
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <input
              type="radio"
              name="exportFormat"
              checked={selectedFormat === 'pptx'}
              onChange={() => setSelectedFormat('pptx')}
              className="mt-1 w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Presentation className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <span className="font-medium text-gray-900 dark:text-white">
                  {t('export.formats.pptx.name')}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('export.formats.pptx.description')}
              </p>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('modal.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            {t('export.confirmButton')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
