import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { open } from '@tauri-apps/plugin-dialog'
import { FileUp, Plus } from 'lucide-react'
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
import { SongList } from '~/features/songs/components'
import { AlertModal } from '~/ui/modal'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'

interface SongsSearchParams {
  q?: string
}

export const Route = createFileRoute('/songs/')({
  component: SongsPage,
  validateSearch: (search: Record<string, unknown>): SongsSearchParams => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
})

function SongsPage() {
  const { t } = useTranslation('songs')
  const navigate = useNavigate()
  const { q: searchQuery = '' } = useSearch({ from: '/songs/' })
  const {
    batchImport,
    isPending: isImporting,
    progress: savingProgress,
  } = useBatchImportSongs()
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [songsToImport, setSongsToImport] = useState<ProcessedImport[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(
    null,
  )
  const [isNoSongsModalOpen, setIsNoSongsModalOpen] = useState(false)

  const handleSongClick = (songId: number) => {
    navigate({
      to: '/songs/$songId',
      params: { songId: String(songId) },
      search: { q: searchQuery || undefined },
    })
  }

  const handleSearchChange = (query: string) => {
    navigate({
      to: '/songs/',
      search: { q: query || undefined },
      replace: true,
    })
  }

  const handleImport = async () => {
    try {
      // Note: filters removed due to macOS bug where files without extensions
      // cannot be selected when filters are present (Tauri issue #6661)
      // OpenSong files often have no extension, so we show all files
      const selected = await open({
        multiple: true,
      })

      if (selected && selected.length > 0) {
        setIsProcessing(true)
        setImportProgress(null)

        const result = await processImportFiles(selected, (progress) => {
          setImportProgress(progress)
        })

        setIsProcessing(false)
        setImportProgress(null)

        if (result.songs.length > 0) {
          setSongsToImport(result.songs)
          setIsImportModalOpen(true)
        } else {
          setIsNoSongsModalOpen(true)
        }
      }
    } catch (error) {
      setIsProcessing(false)
      setImportProgress(null)
      // biome-ignore lint/suspicious/noConsole: error logging
      console.error('[songs] Failed to process import files:', error)
    }
  }

  const handleConfirmImport = async (
    categoryId: number | null,
    options: ImportOptions,
  ) => {
    const result = await batchImport(
      {
        songs: songsToImport.map((s) => {
          // Check if this is an OpenSong import with metadata
          const metadata =
            'metadata' in s.parsed ? s.parsed.metadata : undefined

          // Extract first verse as title if option is enabled
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
            sourceFilename: s.sourceFilename,
            // Include OpenSong metadata if available
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

    setIsImportModalOpen(false)
    setSongsToImport([])

    if (result.songIds.length === 1) {
      navigate({
        to: '/songs/$songId',
        params: { songId: String(result.songIds[0]) },
      })
    }
  }

  const handleCancelImport = () => {
    setIsImportModalOpen(false)
    setSongsToImport([])
  }

  const isPending = isProcessing || isImporting

  return (
    <PagePermissionGuard permission="songs.view">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleImport}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileUp className="w-5 h-5" />
              {t('actions.import')}
            </button>
            <button
              type="button"
              onClick={() =>
                navigate({ to: '/songs/$songId', params: { songId: 'new' } })
              }
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              {t('actions.create')}
            </button>
          </div>
        </div>

        <SongList
          onSongClick={handleSongClick}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
        />

        <ImportConfirmationModal
          isOpen={isImportModalOpen}
          songs={songsToImport.map((s) => s.parsed)}
          onConfirm={handleConfirmImport}
          onCancel={handleCancelImport}
          isPending={isImporting}
          progress={savingProgress}
        />

        <ImportProgressModal isOpen={isProcessing} progress={importProgress} />

        <AlertModal
          isOpen={isNoSongsModalOpen}
          title={t('batchImport.noSongsFound')}
          message={t('batchImport.noSongsFoundDescription')}
          onClose={() => setIsNoSongsModalOpen(false)}
          variant="error"
        />
      </div>
    </PagePermissionGuard>
  )
}
