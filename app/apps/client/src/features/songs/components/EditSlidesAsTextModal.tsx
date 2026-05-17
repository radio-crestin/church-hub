import { FileText, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { LocalSlide } from './SongSlideList'
import { markdownToSlides, slidesToMarkdown } from '../utils/slidesMarkdown'

interface EditSlidesAsTextModalProps {
  isOpen: boolean
  onClose: () => void
  slides: LocalSlide[]
  onSlidesChange: (slides: LocalSlide[]) => void
}

export function EditSlidesAsTextModal({
  isOpen,
  onClose,
  slides,
  onSlidesChange,
}: EditSlidesAsTextModalProps) {
  const { t } = useTranslation('songs')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [text, setText] = useState('')

  // Initialize text from current slides when modal opens
  useEffect(() => {
    if (isOpen) {
      const generatedText = slidesToMarkdown(slides)
      setText(generatedText)
    }
  }, [isOpen, slides])

  // Handle dialog open/close
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
      // Focus textarea after modal opens
      setTimeout(() => textareaRef.current?.focus(), 100)
    } else {
      dialog.close()
    }
  }, [isOpen])

  // Parse text as user types
  const parsedSlides = useMemo(() => {
    return markdownToSlides(text)
  }, [text])

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

  const handleApply = () => {
    onSlidesChange(parsedSlides)
    handleClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 p-0 m-auto w-full max-w-2xl bg-transparent backdrop:bg-black/50 z-[60]"
      onClose={handleClose}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('editAsText.title')}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('editAsText.description')}
          </p>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('editAsText.placeholder')}
            rows={15}
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-mono text-sm"
          />

          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>{t('editAsText.formatHelp')}</p>
          </div>

          {parsedSlides.length > 0 && (
            <p className="text-sm text-indigo-600 dark:text-indigo-400">
              {t('editAsText.preview', { count: parsedSlides.length })}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('editAsText.cancel')}
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('editAsText.save')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
