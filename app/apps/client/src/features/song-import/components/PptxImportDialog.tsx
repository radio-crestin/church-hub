import { FileText, Music, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useUpsertSong } from '~/features/songs/hooks'
import type { ParsedPptx } from '../utils/parsePptx'

function deriveTitleFromFilename(filename: string | null): string {
  if (!filename) return ''
  // Strip any path prefix (handles both / and \ separators) and the extension.
  const base = filename.split(/[\\/]/).pop() ?? filename
  return base.replace(/\.[^.]+$/, '').trim()
}

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
      setTitle(
        deriveTitleFromFilename(sourceFilename) || parsedPptx?.title || '',
      )
    } else {
      dialog.close()
    }
  }, [isOpen, parsedPptx, sourceFilename])

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
      <div className="bg-panel rounded-lg shadow-popover">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-fg-label" />
            <h2 className="text-base font-semibold text-fg">
              {t('songs:pptxImport.title')}
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
          <p className="text-sm text-fg-label">
            {t('songs:pptxImport.description', {
              count: parsedPptx?.slides.length || 0,
            })}
          </p>

          <div>
            <label className="block text-sm font-medium text-fg-body mb-1">
              {t('songs:pptxImport.songTitle')}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-panel border border-line rounded-lg text-fg focus:ring-2 focus:ring-focus focus:border-focus"
              placeholder={t('songs:editor.titlePlaceholder')}
            />
          </div>

          {/* Preview of slides */}
          <div className="max-h-48 overflow-y-auto border border-line rounded-lg">
            {parsedPptx?.slides.map((slide, idx) => (
              <div
                key={slide.slideNumber}
                className="px-3 py-2 border-b border-line last:border-b-0"
              >
                <span className="text-xs text-fg-hint">
                  {t('songs:pptxImport.slideNumber', { number: idx + 1 })}
                </span>
                <p className="text-sm text-fg-body truncate">
                  {slide.text.split('\n')[0]}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-line">
          <button
            type="button"
            onClick={handleClose}
            className="h-9 px-3.5 text-[13px] font-medium bg-field text-fg hover:bg-hover rounded-lg transition-colors"
          >
            {t('common:buttons.cancel')}
          </button>

          <button
            type="button"
            onClick={handleImportAsSong}
            disabled={!title.trim() || upsertMutation.isPending}
            className="flex items-center gap-2 h-9 px-3.5 text-[13px] font-medium bg-primary hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Music className="w-4 h-4" />
            {t('songs:pptxImport.createSong')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
