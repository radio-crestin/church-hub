import { FileText, Music, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useUpsertSong } from '~/features/songs/hooks'
import type { ParsedPptx } from '../utils/parsePptx'

interface PptxImportDialogProps {
  isOpen: boolean
  parsedPptx: ParsedPptx | null
  sourceFilename: string | null
  onConfirm: (songId: number) => void
  onCancel: () => void
}

export function PptxImportDialog({
  isOpen,
  parsedPptx,
  sourceFilename,
  onConfirm,
  onCancel,
}: PptxImportDialogProps) {
  const { t } = useTranslation(['songs', 'common'])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [title, setTitle] = useState('')
  const upsertMutation = useUpsertSong()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
      setTitle(parsedPptx?.title || '')
    } else {
      dialog.close()
    }
  }, [isOpen, parsedPptx])

  const handleImportAsSong = async () => {
    if (!parsedPptx || !title.trim()) return

    const result = await upsertMutation.mutateAsync({
      title: title.trim(),
      sourceFilename,
      slides: parsedPptx.slides.map((slide, idx) => ({
        content: slide.htmlContent,
        sortOrder: idx,
      })),
    })

    if (result.success && result.data) {
      onConfirm(result.data.id)
    }
  }

  const handleClose = () => {
    setTitle('')
    onCancel()
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 p-0 m-auto w-full max-w-lg bg-transparent backdrop:bg-black/50"
      onClose={handleClose}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('songs:pptxImport.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('songs:pptxImport.description', {
              count: parsedPptx?.slides.length || 0,
            })}
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('songs:pptxImport.songTitle')}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder={t('songs:editor.titlePlaceholder')}
            />
          </div>

          {/* Preview of slides */}
          <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            {parsedPptx?.slides.map((slide, idx) => (
              <div
                key={slide.slideNumber}
                className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
              >
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {t('songs:pptxImport.slideNumber', { number: idx + 1 })}
                </span>
                <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {slide.text.split('\n')[0]}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('common:buttons.cancel')}
          </button>
          <button
            type="button"
            onClick={handleImportAsSong}
            disabled={!title.trim() || upsertMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Music className="w-4 h-4" />
            {t('songs:pptxImport.createSong')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
