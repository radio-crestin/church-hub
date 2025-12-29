import { open } from '@tauri-apps/plugin-dialog'
import { Download, FileUp, Globe } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  downloadFromUrl,
  ImportConfirmationModal,
  type ImportOptions,
  type ImportProgress,
  ImportProgressModal,
  type ProcessedImport,
  processImportFiles,
  processZipFromBuffer,
  sanitizeSongTitle,
  useBatchImportSongs,
} from '~/features/song-import'
import { useCategories, useUpsertCategory } from '~/features/songs/hooks'
import { AlertModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'
import { ExportOptionsModal } from './ExportOptionsModal'
import { ExportProgressModal } from './ExportProgressModal'
import { useExportSongs } from '../hooks'

const RESURSE_CRESTINE_URL =
  'https://download.resursecrestine.ro/programe-crestine/cantece-resurse-crestine-opensong-standard.zip'
const RESURSE_CRESTINE_CATEGORY_NAME = 'Resurse Crestine'

type ModalState =
  | { type: 'none' }
  | { type: 'importProgress' }
  | { type: 'importConfirm' }
  | { type: 'noSongs' }
  | { type: 'exportOptions' }

export function ImportExportManager() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const {
    batchImport,
    isPending: isImporting,
    progress: savingProgress,
  } = useBatchImportSongs()
  const {
    exportSongs,
    isPending: isExporting,
    progress: exportProgress,
  } = useExportSongs()
  const { data: categories } = useCategories()
  const { mutateAsync: upsertCategory } = useUpsertCategory()

  const [modalState, setModalState] = useState<ModalState>({ type: 'none' })
  const [songsToImport, setSongsToImport] = useState<ProcessedImport[]>([])
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(
    null,
  )
  const [isImportingFromResurseCrestine, setIsImportingFromResurseCrestine] =
    useState(false)
  const [defaultImportCategoryId, setDefaultImportCategoryId] = useState<
    number | null
  >(null)
  const [defaultImportOptions, setDefaultImportOptions] = useState({
    useFirstVerseAsTitle: true,
    overwriteDuplicates: false,
  })

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
          setDefaultImportCategoryId(null)
          setDefaultImportOptions({
            useFirstVerseAsTitle: true,
            overwriteDuplicates: false,
          })
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

          let title: string
          if (options.useFirstVerseAsTitle && s.parsed.slides.length > 0) {
            const firstSlide = s.parsed.slides[0]
            const firstLine = firstSlide.text.split('\n')[0]?.trim()
            title = sanitizeSongTitle(firstLine || s.parsed.title)
          } else if (s.sourceFilename) {
            // Use exact filename without extension as title (no sanitization)
            title = s.sourceFilename.replace(/\.[^.]+$/, '') || s.parsed.title
          } else {
            title = s.parsed.title
          }

          return {
            title,
            slides: s.parsed.slides.map((slide, idx) => ({
              content: slide.htmlContent,
              sortOrder: idx,
              label: 'label' in slide ? slide.label : null,
            })),
            sourceFilename: s.sourceFilename,
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

  const handleConfirmExport = async (
    categoryId: number | null,
    destination: 'zip' | 'folder',
    fileFormat: 'opensong' | 'pptx',
  ) => {
    setModalState({ type: 'none' })

    const result = await exportSongs({ categoryId, destination, fileFormat })

    if (result.cancelled) {
      // User cancelled the save dialog, do nothing
      return
    }

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

  const handleImportFromResurseCrestine = async () => {
    setIsImportingFromResurseCrestine(true)
    setModalState({ type: 'importProgress' })
    setImportProgress({
      phase: 'downloading',
      current: 0,
      total: null,
      currentFile: 'Resurse Crestine archive',
    })

    try {
      // Step 1: Download the ZIP file
      const zipData = await downloadFromUrl(
        RESURSE_CRESTINE_URL,
        (downloaded, total) => {
          setImportProgress({
            phase: 'downloading',
            current: downloaded,
            total,
            currentFile: 'Resurse Crestine archive',
          })
        },
      )

      // Step 2: Process the ZIP file
      const result = await processZipFromBuffer(zipData, (progress) => {
        setImportProgress(progress)
      })

      setImportProgress(null)

      if (result.songs.length === 0) {
        setModalState({ type: 'noSongs' })
        setIsImportingFromResurseCrestine(false)
        return
      }

      // Step 3: Get or create the "Resurse Crestine" category for default selection
      let categoryId: number | null = null
      const existingCategory = categories?.find(
        (c) => c.name === RESURSE_CRESTINE_CATEGORY_NAME,
      )

      if (existingCategory) {
        categoryId = existingCategory.id
      } else {
        const categoryResult = await upsertCategory({
          name: RESURSE_CRESTINE_CATEGORY_NAME,
        })
        if (categoryResult.success && categoryResult.category) {
          categoryId = categoryResult.category.id
        }
      }

      // Step 4: Show confirmation modal with defaults
      setSongsToImport(result.songs)
      setDefaultImportCategoryId(categoryId)
      setDefaultImportOptions({
        useFirstVerseAsTitle: true,
        overwriteDuplicates: true,
      })
      setModalState({ type: 'importConfirm' })
    } catch (error) {
      setModalState({ type: 'none' })
      setImportProgress(null)
      showToast(
        t('sections.importExport.toast.importFailed', { error: String(error) }),
        'error',
      )
    } finally {
      setIsImportingFromResurseCrestine(false)
    }
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

        {/* Resurse Crestine Import Section */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h4 className="font-medium text-gray-900 dark:text-white">
              {t('sections.importExport.resurseCrestine.title')}
            </h4>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {t('sections.importExport.resurseCrestine.description')}
          </p>
          <button
            type="button"
            onClick={handleImportFromResurseCrestine}
            disabled={isImportingFromResurseCrestine}
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {isImportingFromResurseCrestine
              ? t('sections.importExport.resurseCrestine.importing')
              : t('sections.importExport.resurseCrestine.button')}
          </button>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            {t('sections.importExport.resurseCrestine.note')}
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
        defaultCategoryId={defaultImportCategoryId}
        defaultUseFirstVerseAsTitle={defaultImportOptions.useFirstVerseAsTitle}
        defaultOverwriteDuplicates={defaultImportOptions.overwriteDuplicates}
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

      <ExportProgressModal isOpen={isExporting} progress={exportProgress} />
    </div>
  )
}
