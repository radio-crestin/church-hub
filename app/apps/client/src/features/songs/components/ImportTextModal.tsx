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
  const mouseDownTargetRef = useRef<EventTarget | null>(null)

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
      className="fixed inset-0 p-0 m-auto w-full max-w-lg bg-transparent backdrop:bg-black/50"
      onClose={handleClose}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="bg-panel rounded-lg shadow-popover">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-fg-label" />
            <h2 className="text-base font-semibold text-fg">
              {t('import.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 hover:bg-hover rounded transition-colors"
          >
            <X className="w-5 h-5 text-fg-hint" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-fg-label">{t('import.description')}</p>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('import.placeholder')}
            rows={10}
            className="w-full px-3 py-2 bg-panel border border-line rounded-lg text-fg placeholder:text-fg-hint focus:ring-2 focus:ring-focus focus:border-focus resize-none font-mono text-sm"
          />

          {parsedSlides.length > 0 && (
            <p className="text-sm text-fg-label">
              {t('import.preview', { count: parsedSlides.length })}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-line">
          <button
            type="button"
            onClick={handleClose}
            className="h-9 px-3.5 text-[13px] font-medium bg-field text-fg hover:bg-hover rounded-lg transition-colors"
          >
            {t('import.cancel')}
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={parsedSlides.length === 0}
            className="h-9 px-3.5 text-[13px] font-medium bg-primary hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('import.confirm')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
