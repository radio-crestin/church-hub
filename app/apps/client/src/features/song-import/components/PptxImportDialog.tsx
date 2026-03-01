import { AlertTriangle, FileText, Music, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useUpsertSong } from '~/features/songs/hooks'
import { getSongById } from '~/features/songs/service'
import type { ParsedPptx } from '../utils/parsePptx'

interface PptxImportDialogProps {
  isOpen: boolean
  parsedPptx: ParsedPptx | null
  sourceFilename: string | null
  onConfirm: (songId: number) => void
  onCancel: () => void
}

type DuplicateState =
  | { kind: 'none' }
  | { kind: 'identical'; existingSongId: number; existingTitle: string }
  | { kind: 'different'; existingSongId: number; existingTitle: string }

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
  const [duplicate, setDuplicate] = useState<DuplicateState>({ kind: 'none' })
  const upsertMutation = useUpsertSong()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
      setTitle(parsedPptx?.title || '')
      setDuplicate({ kind: 'none' })
    } else {
      dialog.close()
    }
  }, [isOpen, parsedPptx])

  const handleImportAsSong = async () => {
    if (!parsedPptx || !title.trim()) return

    const importedSlides = parsedPptx.slides.map((slide, idx) => ({
      content: slide.htmlContent,
      sortOrder: idx,
    }))

    const result = await upsertMutation.mutateAsync({
      title: title.trim(),
      sourceFilename,
      slides: importedSlides,
    })

    if (result.success && result.data) {
      onConfirm(result.data.id)
      return
    }

    // Duplicate title detected — compare content to decide warning level
    if (result.isDuplicate && result.existingSongId) {
      const existingSong = await getSongById(result.existingSongId)
      const existingSlides = existingSong?.slides ?? []

      const contentIdentical =
        existingSlides.length === importedSlides.length &&
        existingSlides.every((slide, i) => {
          const importedContent = importedSlides[i]?.content.trim() ?? ''
          return slide.content.trim() === importedContent
        })

      setDuplicate({
        kind: contentIdentical ? 'identical' : 'different',
        existingSongId: result.existingSongId,
        existingTitle: result.existingSongTitle ?? title.trim(),
      })
    }
  }

  // Import with auto-numbered title (when content differs)
  const handleImportWithNewTitle = async () => {
    if (!parsedPptx || duplicate.kind !== 'different') return

    // Find a free title by appending (2), (3)…
    let candidate = title.trim()
    let counter = 2
    let importResult = await upsertMutation.mutateAsync({
      title: candidate,
      sourceFilename,
      slides: parsedPptx.slides.map((slide, idx) => ({
        content: slide.htmlContent,
        sortOrder: idx,
      })),
    })

    while (importResult.isDuplicate) {
      candidate = `${title.trim()} (${counter})`
      counter++
      importResult = await upsertMutation.mutateAsync({
        title: candidate,
        sourceFilename,
        slides: parsedPptx.slides.map((slide, idx) => ({
          content: slide.htmlContent,
          sortOrder: idx,
        })),
      })
    }

    if (importResult.success && importResult.data) {
      onConfirm(importResult.data.id)
    }
  }

  const handleClose = () => {
    setTitle('')
    setDuplicate({ kind: 'none' })
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
              onChange={(e) => {
                setTitle(e.target.value)
                setDuplicate({ kind: 'none' })
              }}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder={t('songs:editor.titlePlaceholder')}
            />
          </div>

          {/* Duplicate warning: identical content */}
          {duplicate.kind === 'identical' && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                {t('songs:pptxImport.duplicateIdentical', {
                  title: duplicate.existingTitle,
                })}
              </p>
            </div>
          )}

          {/* Duplicate warning: different content */}
          {duplicate.kind === 'different' && (
            <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
              <p className="text-sm text-orange-800 dark:text-orange-300">
                {t('songs:pptxImport.duplicateDifferent', {
                  title: duplicate.existingTitle,
                })}
              </p>
            </div>
          )}

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

          {duplicate.kind === 'different' && (
            <button
              type="button"
              onClick={handleImportWithNewTitle}
              disabled={upsertMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Music className="w-4 h-4" />
              {t('songs:pptxImport.importAsNew')}
            </button>
          )}

          {duplicate.kind !== 'different' && (
            <button
              type="button"
              onClick={handleImportAsSong}
              disabled={
                !title.trim() ||
                upsertMutation.isPending ||
                duplicate.kind === 'identical'
              }
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Music className="w-4 h-4" />
              {t('songs:pptxImport.createSong')}
            </button>
          )}
        </div>
      </div>
    </dialog>
  )
}
