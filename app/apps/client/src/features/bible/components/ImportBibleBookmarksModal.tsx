import { AlertTriangle, FileText, FolderOpen, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useImportBibleBookmarksFromText } from '../hooks'
import type { BibleBookmarkImportResult } from '../service'

interface ImportBibleBookmarksModalProps {
  isOpen: boolean
  onClose: () => void
  /** Translation used for references that do not name one themselves. */
  translationId?: number
}

export function ImportBibleBookmarksModal({
  isOpen,
  onClose,
  translationId,
}: ImportBibleBookmarksModalProps) {
  const { t } = useTranslation('bible')
  const [text, setText] = useState('')
  const [result, setResult] = useState<BibleBookmarkImportResult | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const importMutation = useImportBibleBookmarksFromText()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen])

  const handleClose = useCallback(() => {
    setText('')
    setResult(null)
    onClose()
  }, [onClose])

  const handleImport = useCallback(async () => {
    if (!text.trim()) return

    const outcome = await importMutation.mutateAsync({ text, translationId })
    setResult(outcome)

    // Nothing to correct, so get out of the way instead of making the operator
    // dismiss a success message.
    if (outcome.errors.length === 0) {
      handleClose()
    }
  }, [text, translationId, importMutation, handleClose])

  /** Reads a .txt file into the textarea, in the browser and in Tauri alike. */
  const handlePickFile = useCallback(async () => {
    const isTauri =
      typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

    if (!isTauri) {
      fileInputRef.current?.click()
      return
    }

    const { open } = await import('@tauri-apps/plugin-dialog')
    const { readTextFile } = await import('@tauri-apps/plugin-fs')

    const selected = await open({
      multiple: false,
      filters: [{ name: 'Text File', extensions: ['txt'] }],
    })

    if (typeof selected === 'string') {
      setText(await readTextFile(selected))
      setResult(null)
    }
  }, [])

  const handleFileInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      setText(await file.text())
      setResult(null)
      // Let the same file be picked again after a correction.
      event.target.value = ''
    },
    [],
  )

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (
      e.target === dialogRef.current &&
      mouseDownTargetRef.current === dialogRef.current
    ) {
      handleClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      data-testid="bible-bookmarks-import-modal"
      className="fixed inset-0 p-0 m-auto w-full max-w-lg bg-transparent backdrop:bg-black/50"
      onClose={handleClose}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('bookmarks.import.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t('bookmarks.import.cancel')}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('bookmarks.import.description')}
          </p>

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setResult(null)
            }}
            placeholder={t('bookmarks.import.placeholder')}
            rows={10}
            data-testid="bible-bookmarks-import-textarea"
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none font-mono text-sm"
          />

          <button
            type="button"
            onClick={handlePickFile}
            className="inline-flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
          >
            <FolderOpen className="w-4 h-4" />
            {t('bookmarks.import.chooseFile')}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Only shown when something could not be imported: the modal closes
              itself on a clean run. */}
          {result && result.errors.length > 0 && (
            <div
              data-testid="bible-bookmarks-import-errors"
              className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20"
            >
              <div className="flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4" />
                {t('bookmarks.import.partial', {
                  imported: result.imported,
                  skipped: result.errors.length,
                })}
              </div>
              <ul className="mt-2 space-y-1">
                {result.errors.map((error) => (
                  <li
                    key={`${error.line}-${error.content}`}
                    className="text-xs text-amber-700 dark:text-amber-400"
                  >
                    <span className="font-mono">
                      {t('bookmarks.import.line', { line: error.line })}
                    </span>{' '}
                    {error.content} &mdash;{' '}
                    {t(`bookmarks.import.errors.${error.reason}`)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('bookmarks.import.cancel')}
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!text.trim() || importMutation.isPending}
            data-testid="bible-bookmarks-import-confirm"
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('bookmarks.import.confirm')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
