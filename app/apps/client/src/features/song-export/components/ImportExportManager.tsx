import { open } from '@tauri-apps/plugin-dialog'
import { Download, FileUp } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  ImportConfirmationModal,
  type ImportOptions,
  type ImportProgress,
  ImportProgressModal,
  type ProcessedImport,
  processImportFiles,
  useBatchImportSongs,
} from '~/features/song-import'
import { AlertModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'
import { ExportOptionsModal } from './ExportOptionsModal'
import { ExportProgressModal } from './ExportProgressModal'
import { useExportSongs } from '../hooks'

type ModalState =
  | { type: 'none' }
  | { type: 'importProgress' }
  | { type: 'importConfirm' }
  | { type: 'noSongs' }
  | { type: 'exportOptions' }
  | { type: 'exportProgress' }

export function ImportExportManager() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const {
    batchImport,
    isPending: isImporting,
    progress: savingProgress,
  } = useBatchImportSongs()
  const { exportSongs, progress: exportProgress } = useExportSongs()

  const [modalState, setModalState] = useState<ModalState>({ type: 'none' })
  const [songsToImport, setSongsToImport] = useState<ProcessedImport[]>([])
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(
    null,
  )

  const handleImport = async () => {
    try {
      const selected = await open({
        multiple: true,
      })

      if (selected && selected.length > 0) {
        setModalState({ type: 'importProgress' })
        setImportProgress(null)

        const result = await processImportFiles(selected, (progress) => {
          setImportProgress(progress)
        })

        setImportProgress(null)

        if (result.songs.length > 0) {
          setSongsToImport(result.songs)
          setModalState({ type: 'importConfirm' })
        } else {
          setModalState({ type: 'noSongs' })
        }
      }
    } catch (error) {
      setModalState({ type: 'none' })
      setImportProgress(null)
      showToast(
        t('sections.importExport.toast.importFailed', { error: String(error) }),
        'error',
      )
    }
  }

  const handleConfirmImport = async (
    categoryId: number | null,
    options: ImportOptions,
  ) => {
    const result = await batchImport(
      {
        songs: songsToImport.map((s) => {
          const metadata =
            'metadata' in s.parsed ? s.parsed.metadata : undefined

          let title = s.parsed.title
          if (options.useFirstVerseAsTitle && s.parsed.slides.length > 0) {
            const firstSlide = s.parsed.slides[0]
            const firstLine = firstSlide.text.split('\n')[0]?.trim()
            if (firstLine) {
              title = firstLine
            }
          }

          return {
            title,
            slides: s.parsed.slides.map((slide, idx) => ({
              content: slide.htmlContent,
              sortOrder: idx,
              label: 'label' in slide ? slide.label : null,
            })),
            sourceFilePath: s.sourceFilePath,
            author: metadata?.author,
            copyright: metadata?.copyright,
            ccli: metadata?.ccli,
            key: metadata?.key,
            tempo: metadata?.tempo,
            timeSignature: metadata?.timeSignature,
            theme: metadata?.theme,
            altTheme: metadata?.altTheme,
            hymnNumber: metadata?.hymnNumber,
            keyLine: metadata?.keyLine,
            presentationOrder: metadata?.presentationOrder,
          }
        }),
        categoryId,
      },
      { overwriteDuplicates: options.overwriteDuplicates },
    )

    setModalState({ type: 'none' })
    setSongsToImport([])

    if (result.songIds.length > 0) {
      showToast(
        t('sections.importExport.toast.importSuccess', {
          count: result.songIds.length,
        }),
        'success',
      )
    }
  }

  const handleCancelImport = () => {
    setModalState({ type: 'none' })
    setSongsToImport([])
  }

  const handleExport = () => {
    setModalState({ type: 'exportOptions' })
  }

  const handleConfirmExport = async (categoryId: number | null) => {
    setModalState({ type: 'exportProgress' })

    const result = await exportSongs({ categoryId })

    setModalState({ type: 'none' })

    if (result.success) {
      showToast(
        t('sections.importExport.toast.exportSuccess', {
          count: result.songCount,
        }),
        'success',
      )
    } else {
      showToast(
        t('sections.importExport.toast.exportFailed', { error: result.error }),
        'error',
      )
    }
  }

  const handleCancelExport = () => {
    setModalState({ type: 'none' })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('sections.importExport.title')}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('sections.importExport.description')}
        </p>
      </div>

      <div className="space-y-4">
        {/* Import Section */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h4 className="font-medium text-gray-900 dark:text-white">
              {t('sections.importExport.import.title')}
            </h4>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {t('sections.importExport.import.description')}
          </p>
          <button
            type="button"
            onClick={handleImport}
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            {t('sections.importExport.import.button')}
          </button>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            {t('sections.importExport.import.supportedFormats')}
          </p>
        </div>

        {/* Export Section */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h4 className="font-medium text-gray-900 dark:text-white">
              {t('sections.importExport.export.title')}
            </h4>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {t('sections.importExport.export.description')}
          </p>
          <button
            type="button"
            onClick={handleExport}
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            {t('sections.importExport.export.button')}
          </button>
        </div>
      </div>

      {/* Import Modals */}
      <ImportProgressModal
        isOpen={modalState.type === 'importProgress'}
        progress={importProgress}
      />

      <ImportConfirmationModal
        isOpen={modalState.type === 'importConfirm'}
        songs={songsToImport.map((s) => s.parsed)}
        onConfirm={handleConfirmImport}
        onCancel={handleCancelImport}
        isPending={isImporting}
        progress={savingProgress}
      />

      <AlertModal
        isOpen={modalState.type === 'noSongs'}
        title={t('sections.importExport.import.noSongsTitle')}
        message={t('sections.importExport.import.noSongsMessage')}
        onClose={() => setModalState({ type: 'none' })}
      />

      {/* Export Modals */}
      <ExportOptionsModal
        isOpen={modalState.type === 'exportOptions'}
        onConfirm={handleConfirmExport}
        onCancel={handleCancelExport}
      />

      <ExportProgressModal
        isOpen={modalState.type === 'exportProgress'}
        progress={exportProgress}
      />
    </div>
  )
}
