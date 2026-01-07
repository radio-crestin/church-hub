import {
  Check,
  ExternalLink,
  FileCode,
  FolderOpen,
  Loader2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button/Button'
import { useOBSExport } from '../../hooks/useOBSExport'
import type { ExportMode } from '../../service/obs-export'
import type { Screen } from '../../types'
import { getFrontendUrl, openInBrowser } from '../../utils/openDisplayWindow'

interface ScreenExportModalProps {
  isOpen: boolean
  onClose: () => void
  screen: Screen
}

export function ScreenExportModal({
  isOpen,
  onClose,
  screen,
}: ScreenExportModalProps) {
  const { t } = useTranslation('settings')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [selectedMode, setSelectedMode] = useState<ExportMode>('staticFile')

  const { exportToFile, isExporting, progress, error, filePath, retry } =
    useOBSExport({
      screenId: screen.id,
      screenName: screen.name,
    })

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
      // Reset state when opening
      setSelectedMode('staticFile')
    } else {
      dialog.close()
    }
  }, [isOpen])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose()
    }
  }

  const handleExport = async () => {
    if (selectedMode === 'url') {
      const url = `${getFrontendUrl()}/screen/${screen.id}`
      await openInBrowser(url)
      onClose()
    } else {
      await exportToFile()
    }
  }

  const handleOpenFolder = async () => {
    if (!filePath) return

    try {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
      await revealItemInDir(filePath)
    } catch {
      // Fallback: just close the modal
    }
  }

  const isSuccess = progress === 'success'
  const isError = progress === 'error'

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-lg shadow-xl backdrop:bg-black/50 bg-white dark:bg-gray-800 max-w-md w-full"
      onClose={onClose}
      onClick={handleBackdropClick}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('sections.screens.export.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {t('sections.screens.export.description')}
        </p>

        {/* Options */}
        {!isSuccess && (
          <div className="space-y-3 mb-6">
            {/* URL Option */}
            <label
              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                selectedMode === 'url'
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <input
                type="radio"
                name="exportMode"
                value="url"
                checked={selectedMode === 'url'}
                onChange={() => setSelectedMode('url')}
                className="mt-1 accent-indigo-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {t('sections.screens.export.options.url.title')}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {t('sections.screens.export.options.url.description')}
                </p>
              </div>
            </label>

            {/* Static File Option */}
            <label
              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                selectedMode === 'staticFile'
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <input
                type="radio"
                name="exportMode"
                value="staticFile"
                checked={selectedMode === 'staticFile'}
                onChange={() => setSelectedMode('staticFile')}
                className="mt-1 accent-indigo-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {t('sections.screens.export.options.staticFile.title')}
                  </span>
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    {t(
                      'sections.screens.export.options.staticFile.recommended',
                    )}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {t('sections.screens.export.options.staticFile.description')}
                </p>
              </div>
            </label>
          </div>
        )}

        {/* Note about OBS */}
        {!isSuccess && selectedMode === 'staticFile' && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-6">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {t('sections.screens.export.note')}
            </p>
          </div>
        )}

        {/* Success State */}
        {isSuccess && filePath && (
          <div className="mb-6">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-3">
              <Check className="w-5 h-5" />
              <span className="font-medium">
                {t('sections.screens.export.success')}
              </span>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {t('sections.screens.export.filePath', { path: '' })}
              </p>
              <code className="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">
                {filePath}
              </code>
            </div>
          </div>
        )}

        {/* Error State */}
        {isError && error && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 mb-6">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          {isSuccess ? (
            <>
              <Button variant="secondary" onClick={handleOpenFolder}>
                <FolderOpen className="w-4 h-4 mr-2" />
                {t('sections.screens.export.openFolder')}
              </Button>
              <Button onClick={onClose}>
                {t('common:buttons.done', 'Done')}
              </Button>
            </>
          ) : isError ? (
            <>
              <Button variant="ghost" onClick={onClose}>
                {t('sections.screens.export.cancel')}
              </Button>
              <Button onClick={retry}>
                {t('sections.screens.export.retry')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose} disabled={isExporting}>
                {t('sections.screens.export.cancel')}
              </Button>
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {isExporting
                  ? t('sections.screens.export.generating')
                  : selectedMode === 'url'
                    ? t('sections.screens.export.options.url.title')
                    : t('sections.screens.export.export')}
              </Button>
            </>
          )}
        </div>
      </div>
    </dialog>
  )
}
