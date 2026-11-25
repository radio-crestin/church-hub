import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { SongTag } from '../../types'

interface TagFormProps {
  isOpen: boolean
  tag?: SongTag
  onSubmit: (name: string) => void
  onCancel: () => void
  isLoading: boolean
}

export function TagForm({
  isOpen,
  tag,
  onSubmit,
  onCancel,
  isLoading,
}: TagFormProps) {
  const { t } = useTranslation('settings')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(tag?.name ?? '')

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
      inputRef.current?.focus()
    } else {
      dialogRef.current?.close()
    }
  }, [isOpen])

  useEffect(() => {
    setName(tag?.name ?? '')
  }, [tag])

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
      className="fixed inset-0 m-auto p-0 rounded-xl shadow-popover backdrop:bg-black/50 bg-panel max-w-md w-full"
      onClose={onCancel}
      onClick={handleDialogClick}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-fg">
            {tag
              ? t('sections.tags.modals.edit.title')
              : t('sections.tags.modals.create.title')}
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
              {t('sections.tags.tagName')}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('sections.tags.tagNamePlaceholder')}
              className="w-full px-3 py-2 border border-line rounded-lg bg-field text-fg focus:ring-2 focus:ring-focus focus:border-focus"
              required
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
              {tag
                ? t('sections.tags.modals.edit.submit')
                : t('sections.tags.modals.create.submit')}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  )
}
