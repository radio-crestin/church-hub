import { sanitizeSongTitle } from '@church-hub/song-formats'
import { FileUp, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CategoryPicker } from '~/features/songs/components'
import type { ImportOptions, ParsedSong } from '../types'
import type { ParsedPptx } from '../utils/parsePptx'

interface SongWithFilename {
  parsed: ParsedPptx | ParsedSong
  sourceFilename: string | null
}

interface ImportConfirmationModalProps {
  isOpen: boolean
  songs: SongWithFilename[]
  onConfirm: (categoryId: number | null, options: ImportOptions) => void
  onCancel: () => void
  isPending: boolean
  progress?: number
}

export function ImportConfirmationModal({
  isOpen,
  songs,
  onConfirm,
  onCancel,
  isPending,
  progress = 0,
}: ImportConfirmationModalProps) {
  const { t } = useTranslation('songs')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [overwriteDuplicates, setOverwriteDuplicates] = useState(false)
  const [useFirstVerseAsTitle, setUseFirstVerseAsTitle] = useState(true)
  const [skipManuallyEdited, setSkipManuallyEdited] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setCategoryId(null)
      setOverwriteDuplicates(false)
      setUseFirstVerseAsTitle(true)
      setSkipManuallyEdited(false)
    }
  }, [isOpen])

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (
      e.target === dialogRef.current &&
      mouseDownTargetRef.current === dialogRef.current &&
      !isPending
    ) {
      onCancel()
    }
  }

  const handleConfirm = () => {
    onConfirm(categoryId, {
      overwriteDuplicates,
      useFirstVerseAsTitle,
      skipManuallyEdited,
    })
  }

  const songCount = songs.length

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-xl shadow-popover backdrop:bg-black/50 bg-panel"
      onClose={onCancel}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="p-6 min-w-[400px] max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileUp className="w-5 h-5 text-fg-label" />
            <h2 className="text-base font-semibold text-fg">
              {t('batchImport.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <p className="text-fg-label mb-4">
          {t('batchImport.description', { count: songCount })}
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-fg-body mb-1">
            {t('batchImport.categoryLabel')}
          </label>
          <CategoryPicker
            value={categoryId}
            onChange={setCategoryId}
            disabled={isPending}
            portalContainer={dialogRef.current}
          />
        </div>

        <div className="mb-4 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useFirstVerseAsTitle}
              onChange={(e) => setUseFirstVerseAsTitle(e.target.checked)}
              disabled={isPending}
              className="w-4 h-4 text-primary bg-field border-line rounded focus:ring-focus disabled:opacity-50"
            />
            <span className="text-sm text-fg-body">
              {t('batchImport.useFirstVerseAsTitle')}
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={overwriteDuplicates}
              onChange={(e) => setOverwriteDuplicates(e.target.checked)}
              disabled={isPending}
              className="w-4 h-4 text-primary bg-field border-line rounded focus:ring-focus disabled:opacity-50"
            />
            <span className="text-sm text-fg-body">
              {t('batchImport.overwriteDuplicates')}
            </span>
          </label>
          <label
            className={`flex items-center gap-2 ${!overwriteDuplicates ? 'opacity-50' : 'cursor-pointer'}`}
          >
            <input
              type="checkbox"
              checked={skipManuallyEdited}
              onChange={(e) => setSkipManuallyEdited(e.target.checked)}
              disabled={isPending || !overwriteDuplicates}
              className="w-4 h-4 text-primary bg-field border-line rounded focus:ring-focus disabled:opacity-50"
            />
            <span className="text-sm text-fg-body">
              {t('batchImport.skipManuallyEdited')}
            </span>
          </label>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-fg-body mb-2">
            {t('batchImport.songsList')}
          </label>
          <div className="max-h-48 overflow-y-auto border border-line rounded-lg">
            <ul className="divide-y divide-line">
              {songs.map((song, index) => {
                // Get both possible titles for comparison
                let verseTitle: string
                let filenameTitle: string

                // Extract first verse title (sanitized)
                const firstSlide = song.parsed.slides[0]
                if (firstSlide) {
                  const firstLine = firstSlide.text.split('\n')[0]?.trim()
                  verseTitle = sanitizeSongTitle(firstLine || song.parsed.title)
                } else {
                  verseTitle = song.parsed.title
                }

                // Extract filename title - NO sanitization, just remove extension
                if (song.sourceFilename) {
                  filenameTitle = song.sourceFilename.replace(/\.[^.]+$/, '')
                } else {
                  filenameTitle = song.parsed.title
                }

                // Choose based on setting
                const displayTitle = useFirstVerseAsTitle
                  ? verseTitle
                  : filenameTitle

                return (
                  <li
                    key={`${index}-${useFirstVerseAsTitle}`}
                    className="px-3 py-2 text-sm text-fg"
                  >
                    {index + 1}. {displayTitle}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {isPending ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 text-fg-hint animate-spin" />
              <span className="text-sm font-medium text-fg-body">
                {t('batchImport.saving')} {progress}%
              </span>
            </div>
            <div className="w-full bg-field rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="h-9 px-3.5 text-[13px] font-medium bg-field text-fg hover:bg-hover rounded-lg transition-colors"
            >
              {t('common:buttons.cancel', { ns: 'common' })}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="h-9 px-3.5 text-[13px] font-medium bg-primary hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              {t('batchImport.confirmButton', { count: songCount })}
            </button>
          </div>
        )}
      </div>
    </dialog>
  )
}
