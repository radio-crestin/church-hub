import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface UnsavedChangesModalProps {
  isOpen: boolean
  onDiscard: () => void
  onCancel: () => void
}

export function UnsavedChangesModal({
  isOpen,
  onDiscard,
  onCancel,
}: UnsavedChangesModalProps) {
  const { t } = useTranslation(['songs', 'common'])
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onCancel()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-lg shadow-xl backdrop:bg-black/50 bg-white dark:bg-gray-800"
      onClose={onCancel}
      onClick={handleBackdropClick}
    >
      <div className="p-6 min-w-[300px] max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {t('songs:modal.unsavedChangesTitle')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {t('songs:modal.unsavedChangesMessage')}
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('common:buttons.cancel')}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            {t('songs:modal.discardChanges')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
