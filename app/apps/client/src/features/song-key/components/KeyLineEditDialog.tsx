import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Song } from '../../songs/types'
import { useUpdateSongKeyLine } from '../hooks/useUpdateSongKeyLine'

interface KeyLineEditDialogProps {
  song: Song | null
  isOpen: boolean
  onClose: () => void
}

export function KeyLineEditDialog({
  song,
  isOpen,
  onClose,
}: KeyLineEditDialogProps) {
  const { t } = useTranslation('songKey')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [keyLine, setKeyLine] = useState('')
  const updateMutation = useUpdateSongKeyLine()

  useEffect(() => {
    if (isOpen && song) {
      setKeyLine(song.keyLine || '')
      dialogRef.current?.showModal()
      // Focus and select input content
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    } else {
      dialogRef.current?.close()
    }
  }, [isOpen, song])

  const handleSave = async () => {
    if (!song) return

    await updateMutation.mutateAsync({
      songId: song.id,
      songTitle: song.title,
      keyLine: keyLine.trim(),
    })
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !updateMutation.isPending) {
      e.preventDefault()
      handleSave()
    }
  }

  // Handle click on backdrop to close
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-x-0 top-4 sm:top-auto sm:inset-0 mx-auto sm:m-auto p-0 rounded-xl shadow-2xl backdrop:bg-black/50 max-w-md w-[calc(100%-2rem)] sm:w-full"
      onClose={onClose}
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {t('dialog.title')}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 py-4 space-y-4">
          {song && (
            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('dialog.songTitle')}
              </label>
              <p className="text-gray-900 dark:text-white font-medium break-words">
                {song.title}
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="keyLine"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t('dialog.keyLine')}
            </label>
            <input
              ref={inputRef}
              id="keyLine"
              type="text"
              value={keyLine}
              onChange={(e) => setKeyLine(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('dialog.keyLinePlaceholder')}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300
              bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600
              transition-colors"
          >
            {t('dialog.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg
              hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {updateMutation.isPending ? t('dialog.saving') : t('dialog.save')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
