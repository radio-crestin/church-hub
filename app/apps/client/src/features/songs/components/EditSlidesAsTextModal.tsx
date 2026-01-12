import { FileText, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { LocalSlide } from './SongSlideList'

interface EditSlidesAsTextModalProps {
  isOpen: boolean
  onClose: () => void
  slides: LocalSlide[]
  onSlidesChange: (slides: LocalSlide[]) => void
}

function htmlToMarkdown(html: string): string {
  let text = html

  // Convert bold tags to markdown
  text = text.replace(/<(strong|b)>(.*?)<\/\1>/gi, '**$2**')

  // Convert italic tags to markdown
  text = text.replace(/<(em|i)>(.*?)<\/\1>/gi, '*$2*')

  // Convert underline to markdown (using __)
  text = text.replace(/<u>(.*?)<\/u>/gi, '__$1__')

  // Replace <br>, <br/>, <br /> with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n')

  // Replace </p><p> with double newlines (paragraph breaks within a slide)
  text = text.replace(/<\/p>\s*<p>/gi, '\n')

  // Remove opening and closing p tags
  text = text.replace(/<\/?p>/gi, '')

  // Decode HTML entities
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text

  return textarea.value.trim()
}

function markdownToHtml(markdown: string): string {
  let html = markdown

  // Escape HTML special characters first (but not our markdown syntax)
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // Convert bold markdown to HTML (must do before italic to handle **text**)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // Convert underline markdown to HTML (must do before italic)
  html = html.replace(/__(.+?)__/g, '<u>$1</u>')

  // Convert italic markdown to HTML
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  return html
}

function slidesToMarkdown(slides: LocalSlide[]): string {
  // Export slides separated by --- for clarity
  return slides
    .map((slide) => htmlToMarkdown(slide.content))
    .join('\n\n---\n\n')
}

function markdownToSlides(text: string): LocalSlide[] {
  if (!text.trim()) return []

  // Normalize separators: replace --- with empty lines, then split by empty lines
  // This handles both --- and empty lines as slide separators
  const normalized = text.replace(/\n\s*---\s*\n/g, '\n\n')

  // Split by empty lines (double newlines)
  const slideTexts = normalized
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0) // Skip empty slides

  return slideTexts
    .map((slideText, idx) => {
      // Each line within the slide becomes a <p>
      const lines = slideText
        .split('\n')
        .filter((line) => line.trim().length > 0)

      // Skip if no content after filtering empty lines
      if (lines.length === 0) {
        return null
      }

      const htmlContent = lines
        .map((line) => `<p>${markdownToHtml(line)}</p>`)
        .join('')

      return {
        id: `temp-${Date.now()}-${idx}`,
        content: htmlContent || '<p></p>',
        sortOrder: idx,
      }
    })
    .filter((slide): slide is LocalSlide => slide !== null)
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
