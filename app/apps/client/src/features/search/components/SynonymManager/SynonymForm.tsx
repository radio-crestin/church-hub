import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { SynonymGroup } from '~/service/synonyms'

interface SynonymFormProps {
  isOpen: boolean
  synonym?: SynonymGroup
  onSubmit: (primary: string, synonyms: string[]) => void
  onCancel: () => void
  isLoading: boolean
}

export function SynonymForm({
  isOpen,
  synonym,
  onSubmit,
  onCancel,
  isLoading,
}: SynonymFormProps) {
  const { t } = useTranslation('settings')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [primary, setPrimary] = useState(synonym?.primary ?? '')
  const [synonymsText, setSynonymsText] = useState(
    synonym?.synonyms.join(', ') ?? '',
  )

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
      inputRef.current?.focus()
    } else {
      dialogRef.current?.close()
    }
  }, [isOpen])

  useEffect(() => {
    setPrimary(synonym?.primary ?? '')
    setSynonymsText(synonym?.synonyms.join(', ') ?? '')
  }, [synonym])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (primary.trim() && synonymsText.trim()) {
      const synonymsList = synonymsText
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0)

      if (synonymsList.length > 0) {
        onSubmit(primary.trim().toLowerCase(), synonymsList)
      }
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
            {synonym
              ? t('sections.synonyms.modals.edit.title')
              : t('sections.synonyms.modals.create.title')}
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
              {t('sections.synonyms.primaryTerm')}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              placeholder={t('sections.synonyms.primaryTermPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('sections.synonyms.synonymTerms')}
            </label>
            <input
              type="text"
              value={synonymsText}
              onChange={(e) => setSynonymsText(e.target.value)}
              placeholder={t('sections.synonyms.synonymTermsPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('sections.synonyms.synonymTermsHint')}
            </p>
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
              disabled={isLoading || !primary.trim() || !synonymsText.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {synonym
                ? t('sections.synonyms.modals.edit.submit')
                : t('sections.synonyms.modals.create.submit')}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  )
}
