import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { SongCategory } from '../../types'

interface CategoryFormProps {
  isOpen: boolean
  category?: SongCategory
  onSubmit: (name: string, value: number) => void
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
  const [value, setValue] = useState(category?.priority ?? 1)

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
    setValue(category?.priority ?? 1)
  }, [category])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onSubmit(name.trim(), value)
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
      className="fixed inset-0 m-auto p-0 rounded-xl shadow-xl backdrop:bg-black/50 bg-panel max-w-md w-full"
      onClose={onCancel}
      onClick={handleDialogClick}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-fg">
            {category
              ? t('sections.categories.modals.edit.title')
              : t('sections.categories.modals.create.title')}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-fg-hint hover:text-fg"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-fg-body mb-1">
              {t('sections.categories.categoryName')}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('sections.categories.categoryNamePlaceholder')}
              className="w-full px-3 py-2 border border-line rounded-lg bg-field text-fg focus:ring-2 focus:ring-focus focus:border-focus"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-fg-body mb-1">
              {t('sections.categories.value')}
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={value}
              onChange={(e) =>
                setValue(Math.trunc(Number(e.target.value)) || 1)
              }
              className="w-full px-3 py-2 border border-line rounded-lg bg-field text-fg focus:ring-2 focus:ring-focus focus:border-focus"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-9 px-3.5 text-[13px] font-medium bg-field text-fg hover:bg-hover rounded-lg transition-colors"
            >
              {t('common:buttons.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="h-9 px-3.5 text-[13px] font-medium bg-primary hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
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
