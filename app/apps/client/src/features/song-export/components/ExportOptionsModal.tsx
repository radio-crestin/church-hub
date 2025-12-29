import { Download, FolderOpen, Package, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CategoryPicker } from '~/features/songs/components'
import type { ExportFormat } from '../types'

interface ExportOptionsModalProps {
  isOpen: boolean
  onConfirm: (categoryId: number | null, format: ExportFormat) => void
  onCancel: () => void
}

export function ExportOptionsModal({
  isOpen,
  onConfirm,
  onCancel,
}: ExportOptionsModalProps) {
  const { t } = useTranslation('settings')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [exportScope, setExportScope] = useState<'all' | 'category'>('all')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('folder')

  // Check if we're in Tauri (folder export only available in desktop app)
  const isTauri =
    typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

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
      setExportScope('all')
      setCategoryId(null)
      setExportFormat(isTauri ? 'folder' : 'zip')
    }
  }, [isOpen, isTauri])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onCancel()
    }
  }

  const handleConfirm = () => {
    onConfirm(exportScope === 'all' ? null : categoryId, exportFormat)
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
              {t('sections.importExport.export.title')}
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
          {t('sections.importExport.export.description')}
        </p>

        <div className="space-y-4 mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="exportScope"
              checked={exportScope === 'all'}
              onChange={() => setExportScope('all')}
              className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('sections.importExport.export.allSongs')}
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="exportScope"
              checked={exportScope === 'category'}
              onChange={() => setExportScope('category')}
              className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('sections.importExport.export.byCategory')}
            </span>
          </label>

          {exportScope === 'category' && (
            <div className="ml-7">
              <CategoryPicker
                value={categoryId}
                onChange={setCategoryId}
                placeholder={t('sections.importExport.export.selectCategory')}
              />
            </div>
          )}
        </div>

        {/* Format Selection */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('sections.importExport.export.formatLabel')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => isTauri && setExportFormat('folder')}
              disabled={!isTauri}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                exportFormat === 'folder' && isTauri
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              } ${!isTauri ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <FolderOpen
                className={`w-8 h-8 ${
                  exportFormat === 'folder' && isTauri
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  exportFormat === 'folder' && isTauri
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {t('sections.importExport.export.formats.folder')}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {isTauri
                  ? t('sections.importExport.export.formats.folderDescription')
                  : t('sections.importExport.export.formats.folderUnavailable')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setExportFormat('zip')}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                exportFormat === 'zip'
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <Package
                className={`w-8 h-8 ${
                  exportFormat === 'zip'
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  exportFormat === 'zip'
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {t('sections.importExport.export.formats.zip')}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {t('sections.importExport.export.formats.zipDescription')}
              </span>
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('common:buttons.cancel', { ns: 'common' })}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={exportScope === 'category' && categoryId === null}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('sections.importExport.export.button')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
