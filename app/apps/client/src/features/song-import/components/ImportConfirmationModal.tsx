import { FileUp, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CategoryPicker } from '~/features/songs/components'
import type { ImportOptions } from '../types'
import type { ParsedPptx } from '../utils/parsePptx'

interface ImportConfirmationModalProps {
  isOpen: boolean
  songs: ParsedPptx[]
  onConfirm: (categoryId: number | null, options: ImportOptions) => void
  onCancel: () => void
  isPending: boolean
  progress?: number
  defaultCategoryId?: number | null
  defaultUseFirstVerseAsTitle?: boolean
  defaultOverwriteDuplicates?: boolean
  defaultSkipManuallyEdited?: boolean
}

export function ImportConfirmationModal({
  isOpen,
  songs,
  onConfirm,
  onCancel,
  isPending,
  progress = 0,
  defaultCategoryId = null,
  defaultUseFirstVerseAsTitle = true,
  defaultOverwriteDuplicates = false,
  defaultSkipManuallyEdited = false,
}: ImportConfirmationModalProps) {
  const { t } = useTranslation('songs')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [categoryId, setCategoryId] = useState<number | null>(defaultCategoryId)
  const [overwriteDuplicates, setOverwriteDuplicates] = useState(
    defaultOverwriteDuplicates,
  )
  const [useFirstVerseAsTitle, setUseFirstVerseAsTitle] = useState(
    defaultUseFirstVerseAsTitle,
  )
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
      setCategoryId(defaultCategoryId)
      setOverwriteDuplicates(defaultOverwriteDuplicates)
      setUseFirstVerseAsTitle(defaultUseFirstVerseAsTitle)
      setSkipManuallyEdited(defaultSkipManuallyEdited)
    }
  }, [
    isOpen,
    defaultCategoryId,
    defaultOverwriteDuplicates,
    defaultUseFirstVerseAsTitle,
    defaultSkipManuallyEdited,
  ])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current && !isPending) {
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
      className="fixed inset-0 m-auto p-0 rounded-lg shadow-xl backdrop:bg-black/50 bg-white dark:bg-gray-800"
      onClose={onCancel}
      onClick={handleBackdropClick}
    >
      <div className="p-6 min-w-[400px] max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('batchImport.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {t('batchImport.description', { count: songCount })}
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('batchImport.categoryLabel')}
          </label>
          <CategoryPicker
            value={categoryId}
            onChange={setCategoryId}
            disabled={isPending}
          />
        </div>

        <div className="mb-4 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useFirstVerseAsTitle}
              onChange={(e) => setUseFirstVerseAsTitle(e.target.checked)}
              disabled={isPending}
              className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('batchImport.useFirstVerseAsTitle')}
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={overwriteDuplicates}
              onChange={(e) => setOverwriteDuplicates(e.target.checked)}
              disabled={isPending}
              className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
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
              className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('batchImport.skipManuallyEdited')}
            </span>
          </label>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('batchImport.songsList')}
          </label>
          <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {songs.map((song, index) => (
                <li
                  key={`${song.title}-${index}`}
                  className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                >
                  {index + 1}. {song.title}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {isPending ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('batchImport.saving')} {progress}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t('common:buttons.cancel', { ns: 'common' })}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              {t('batchImport.confirmButton', { count: songCount })}
            </button>
          </div>
        )}
      </div>
    </dialog>
  )
}
