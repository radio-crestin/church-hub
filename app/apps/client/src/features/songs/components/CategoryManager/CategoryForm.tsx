import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { SongCategory } from '../../types'

interface CategoryFormProps {
  isOpen: boolean
  category?: SongCategory
  onSubmit: (name: string) => void
  onCancel: () => void
  isLoading: boolean
}

export function CategoryForm({
  isOpen,
  category,
  onSubmit,
  onCancel,
  isLoading,
}: CategoryFormProps) {
  const { t } = useTranslation('settings')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(category?.name ?? '')

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
      inputRef.current?.focus()
    } else {
      dialogRef.current?.close()
    }
  }, [isOpen])

  useEffect(() => {
    setName(category?.name ?? '')
  }, [category])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onSubmit(name.trim())
    }
  }

  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onCancel()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-lg shadow-xl backdrop:bg-black/50 bg-white dark:bg-gray-800 max-w-md w-full"
      onClose={onCancel}
      onClick={handleDialogClick}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {category
              ? t('sections.categories.modals.edit.title')
              : t('sections.categories.modals.create.title')}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('sections.categories.categoryName')}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('sections.categories.categoryNamePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t('common:buttons.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {category
                ? t('sections.categories.modals.edit.submit')
                : t('sections.categories.modals.create.submit')}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  )
}
