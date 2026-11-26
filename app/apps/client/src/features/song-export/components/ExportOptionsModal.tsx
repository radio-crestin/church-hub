import {
  Download,
  FileText,
  FolderOpen,
  Package,
  Presentation,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CategoryPicker } from '~/features/songs/components'
import type { ExportDestination, SongFileFormat } from '../types'

interface ExportOptionsModalProps {
  isOpen: boolean
  onConfirm: (
    categoryId: number | null,
    destination: ExportDestination,
    fileFormat: SongFileFormat,
  ) => void
  onCancel: () => void
}

export function ExportOptionsModal({
  isOpen,
  onConfirm,
  onCancel,
}: ExportOptionsModalProps) {
  const { t } = useTranslation('settings')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const [exportScope, setExportScope] = useState<'all' | 'category'>('all')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [destination, setDestination] = useState<ExportDestination>('folder')
  const [fileFormat, setFileFormat] = useState<SongFileFormat>('opensong')

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
      setDestination(isTauri ? 'folder' : 'zip')
      setFileFormat('opensong')
    }
  }, [isOpen, isTauri])

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
    onConfirm(
      exportScope === 'all' ? null : categoryId,
      destination,
      fileFormat,
    )
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-xl shadow-popover backdrop:bg-black/50 bg-panel max-h-[90vh] overflow-y-auto"
      onClose={onCancel}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="p-6 min-w-[400px] max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-fg-label" />
            <h2 className="text-base font-semibold text-fg">
              {t('sections.importExport.export.title')}
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

        <p className="text-fg-label mb-6">
          {t('sections.importExport.export.description')}
        </p>

        {/* Song Selection */}
        <div className="space-y-4 mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="exportScope"
              checked={exportScope === 'all'}
              onChange={() => setExportScope('all')}
              className="w-4 h-4 text-primary bg-field border-line focus:ring-focus"
            />
            <span className="text-sm text-fg-body">
              {t('sections.importExport.export.allSongs')}
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="exportScope"
              checked={exportScope === 'category'}
              onChange={() => setExportScope('category')}
              className="w-4 h-4 text-primary bg-field border-line focus:ring-focus"
            />
            <span className="text-sm text-fg-body">
              {t('sections.importExport.export.byCategory')}
            </span>
          </label>

          {exportScope === 'category' && (
            <div className="ml-7">
              <CategoryPicker
                value={categoryId}
                onChange={setCategoryId}
                portalContainer={dialogRef.current}
              />
            </div>
          )}
        </div>

        {/* File Format Selection */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-fg-body mb-3">
            {t('sections.importExport.export.fileFormatLabel')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFileFormat('opensong')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors cursor-pointer ${
                fileFormat === 'opensong'
                  ? 'border-line-strong bg-selected'
                  : 'border-line hover:bg-hover'
              }`}
            >
              <FileText
                className={`w-8 h-8 ${
                  fileFormat === 'opensong' ? 'text-fg' : 'text-fg-hint'
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  fileFormat === 'opensong' ? 'text-fg' : 'text-fg-body'
                }`}
              >
                {t('sections.importExport.export.fileFormats.opensong')}
              </span>
              <span className="text-xs text-fg-hint text-center">
                {t(
                  'sections.importExport.export.fileFormats.opensongDescription',
                )}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFileFormat('pptx')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors cursor-pointer ${
                fileFormat === 'pptx'
                  ? 'border-line-strong bg-selected'
                  : 'border-line hover:bg-hover'
              }`}
            >
              <Presentation
                className={`w-8 h-8 ${
                  fileFormat === 'pptx' ? 'text-fg' : 'text-fg-hint'
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  fileFormat === 'pptx' ? 'text-fg' : 'text-fg-body'
                }`}
              >
                {t('sections.importExport.export.fileFormats.pptx')}
              </span>
              <span className="text-xs text-fg-hint text-center">
                {t('sections.importExport.export.fileFormats.pptxDescription')}
              </span>
            </button>
          </div>
        </div>

        {/* Destination Selection */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-fg-body mb-3">
            {t('sections.importExport.export.destinationLabel')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => isTauri && setDestination('folder')}
              disabled={!isTauri}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${
                destination === 'folder' && isTauri
                  ? 'border-line-strong bg-selected'
                  : 'border-line hover:bg-hover'
              } ${!isTauri ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <FolderOpen
                className={`w-8 h-8 ${
                  destination === 'folder' && isTauri
                    ? 'text-fg'
                    : 'text-fg-hint'
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  destination === 'folder' && isTauri
                    ? 'text-fg'
                    : 'text-fg-body'
                }`}
              >
                {t('sections.importExport.export.destinations.folder')}
              </span>
              <span className="text-xs text-fg-hint text-center">
                {isTauri
                  ? t(
                      'sections.importExport.export.destinations.folderDescription',
                    )
                  : t(
                      'sections.importExport.export.destinations.folderUnavailable',
                    )}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDestination('zip')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors cursor-pointer ${
                destination === 'zip'
                  ? 'border-line-strong bg-selected'
                  : 'border-line hover:bg-hover'
              }`}
            >
              <Package
                className={`w-8 h-8 ${
                  destination === 'zip' ? 'text-fg' : 'text-fg-hint'
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  destination === 'zip' ? 'text-fg' : 'text-fg-body'
                }`}
              >
                {t('sections.importExport.export.destinations.zip')}
              </span>
              <span className="text-xs text-fg-hint text-center">
                {t('sections.importExport.export.destinations.zipDescription')}
              </span>
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-3.5 text-[13px] font-medium bg-field text-fg hover:bg-hover rounded-lg transition-colors"
          >
            {t('common:buttons.cancel', { ns: 'common' })}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={exportScope === 'category' && categoryId === null}
            className="h-9 px-3.5 text-[13px] font-medium bg-primary hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('sections.importExport.export.button')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
