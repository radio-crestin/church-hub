import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Combobox, type ComboboxOption } from '~/ui/combobox'
import type { BibleTranslation } from '../types'

interface AddTranslationModalProps {
  isOpen: boolean
  availableTranslations: BibleTranslation[]
  onSubmit: (translationId: number) => void
  onClose: () => void
}

export function AddTranslationModal({
  isOpen,
  availableTranslations,
  onSubmit,
  onClose,
}: AddTranslationModalProps) {
  const { t } = useTranslation('settings')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
      setSelectedId(null)
    } else {
      dialog.close()
    }
  }, [isOpen])

  const options: ComboboxOption[] = useMemo(
    () =>
      availableTranslations.map((trans) => ({
        value: trans.id,
        label: `${trans.name} (${trans.abbreviation})`,
      })),
    [availableTranslations],
  )

  const handleSubmit = () => {
    if (selectedId !== null) {
      onSubmit(selectedId)
      onClose()
    }
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-lg shadow-xl backdrop:bg-black/50 bg-white dark:bg-gray-800"
      onClose={onClose}
      onClick={handleBackdropClick}
    >
      <div className="p-6 min-w-[350px] max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('sections.bible.modals.add.title')}
        </h2>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('sections.bible.modals.add.selectLabel')}
            </label>
            <Combobox
              options={options}
              value={selectedId}
              onChange={(val) => setSelectedId(val as number | null)}
              placeholder={t('sections.bible.modals.add.selectLabel')}
              allowClear={false}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('common:buttons.cancel', { defaultValue: 'Cancel' })}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedId === null}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {t('sections.bible.modals.add.submit')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
