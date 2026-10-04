import { AlertTriangle, FileText, FolderOpen, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useLoadBookmarksText, useReplaceBookmarksFromText } from '../hooks'
import type { SongBookmarksTextError } from '../service'

interface EditSongBookmarksTextModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * The song Marcaje as Markdown text: one song per line
 * (`## Title {#song-12}` or just a title), `> note` for a note. Saving makes
 * the list exactly what the text says; an unknown song stops the save and is
 * pointed out by line, so nothing is half applied.
 */
export function EditSongBookmarksTextModal({
  isOpen,
  onClose,
}: EditSongBookmarksTextModalProps) {
  const { t } = useTranslation('songs')
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<SongBookmarksTextError[]>([])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const loadMutation = useLoadBookmarksText()
  const replaceMutation = useReplaceBookmarksFromText()
  const { mutateAsync: loadText } = loadMutation

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (!isOpen) {
      dialog.close()
      return
    }
    dialog.showModal()
    setErrors([])
    loadText().then(setText)
  }, [isOpen, loadText])

  const handleClose = useCallback(() => {
    setText('')
    setErrors([])
    onClose()
  }, [onClose])

  const handleSave = useCallback(async () => {
    const outcome = await replaceMutation.mutateAsync(text)
    if (outcome.applied) {
      handleClose()
      return
    }
    setErrors(outcome.errors)
  }, [text, replaceMutation, handleClose])

  /** Reads an exported .md (or a .txt list) into the editor. */
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
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    })

    if (typeof selected === 'string') {
      setText(await readTextFile(selected))
      setErrors([])
    }
  }, [])

  const handleFileInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      setText(await file.text())
      setErrors([])
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
      data-testid="bookmarks-text-modal"
      className="fixed inset-0 p-0 m-auto w-[calc(100%-2rem)] max-w-xl bg-transparent backdrop:bg-black/50"
      onClose={handleClose}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-5 h-5 shrink-0 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {t('bookmarks.textEdit.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t('bookmarks.textEdit.cancel')}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('bookmarks.textEdit.description')}
          </p>

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setErrors([])
            }}
            placeholder={t('bookmarks.textEdit.placeholder')}
            rows={12}
            spellCheck={false}
            disabled={loadMutation.isPending}
            data-testid="bookmarks-text-textarea"
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-y font-mono text-sm"
          />

          <button
            type="button"
            onClick={handlePickFile}
            className="inline-flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
          >
            <FolderOpen className="w-4 h-4" />
            {t('bookmarks.textEdit.chooseFile')}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {errors.length > 0 && (
            <div
              data-testid="bookmarks-text-errors"
              className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20"
            >
              <div className="flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {t('bookmarks.textEdit.notSaved')}
              </div>
              <ul className="mt-2 space-y-1">
                {errors.map((error) => (
                  <li
                    key={`${error.line}-${error.content}`}
                    className="text-xs text-amber-700 dark:text-amber-400 break-words"
                  >
                    <span className="font-mono">
                      {t('bookmarks.textEdit.line', { line: error.line })}
                    </span>{' '}
                    {error.content} &mdash;{' '}
                    {t(`bookmarks.textEdit.errors.${error.reason}`)}
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
            {t('bookmarks.textEdit.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loadMutation.isPending || replaceMutation.isPending}
            data-testid="bookmarks-text-save"
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('bookmarks.textEdit.save')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
