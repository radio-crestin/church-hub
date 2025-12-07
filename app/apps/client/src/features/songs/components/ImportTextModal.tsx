import { FileText, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface ImportTextModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (slides: string[]) => void
}

export function ImportTextModal({
  isOpen,
  onClose,
  onImport,
}: ImportTextModalProps) {
  const { t } = useTranslation('songs')
  const [text, setText] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen])

  const parsedSlides = useMemo(() => {
    if (!text.trim()) return []

    // Split by double newlines (empty lines)
    return text
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0)
      .map((paragraph) => {
        // Convert plain text to HTML paragraphs
        const lines = paragraph.split('\n')
        return lines.map((line) => `<p>${line}</p>`).join('')
      })
  }, [text])

  const handleImport = () => {
    if (parsedSlides.length > 0) {
      onImport(parsedSlides)
      setText('')
      onClose()
    }
  }

  const handleClose = () => {
    setText('')
    onClose()
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
              {t('import.title')}
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
            {t('import.description')}
          </p>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('import.placeholder')}
            rows={10}
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-mono text-sm"
          />

          {parsedSlides.length > 0 && (
            <p className="text-sm text-indigo-600 dark:text-indigo-400">
              {t('import.preview', { count: parsedSlides.length })}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('import.cancel')}
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={parsedSlides.length === 0}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('import.confirm')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
