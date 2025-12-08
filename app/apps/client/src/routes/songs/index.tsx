import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { open } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'
import { FileUp, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ParsedPptx } from '~/features/pptx-import'
import { PptxImportDialog, parsePptxFile } from '~/features/pptx-import'
import { SongList } from '~/features/songs/components'

export const Route = createFileRoute('/songs/')({
  component: SongsPage,
})

function SongsPage() {
  const { t } = useTranslation('songs')
  const navigate = useNavigate()
  const [parsedPptx, setParsedPptx] = useState<ParsedPptx | null>(null)
  const [sourceFilePath, setSourceFilePath] = useState<string | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)

  const handleSongClick = (songId: number) => {
    navigate({ to: '/songs/$songId', params: { songId: String(songId) } })
  }

  const handleImportPptx = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'PowerPoint',
            extensions: ['pptx'],
          },
        ],
      })

      if (selected && selected.length > 0) {
        // Process the first file for now (could handle multiple in future)
        const filePath = selected[0]
        const fileData = await readFile(filePath)
        const parsed = await parsePptxFile(fileData.buffer)

        setSourceFilePath(filePath)
        setParsedPptx(parsed)
        setShowImportDialog(true)
      }
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: error logging
      console.error('[songs] Failed to open PPTX file:', error)
    }
  }

  const handleConfirmImport = (songId: number) => {
    setShowImportDialog(false)
    setParsedPptx(null)
    setSourceFilePath(null)
    navigate({ to: '/songs/$songId', params: { songId: String(songId) } })
  }

  const handleCancelImport = () => {
    setShowImportDialog(false)
    setParsedPptx(null)
    setSourceFilePath(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {t('title')}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleImportPptx}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
          >
            <FileUp className="w-5 h-5" />
            {t('actions.importPptx')}
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

      <SongList onSongClick={handleSongClick} />

      <PptxImportDialog
        isOpen={showImportDialog}
        parsedPptx={parsedPptx}
        sourceFilePath={sourceFilePath}
        onConfirm={handleConfirmImport}
        onCancel={handleCancelImport}
      />
    </div>
  )
}
