import { AlertTriangle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

export type DuplicateAction =
  | 'openExisting'
  | 'overwrite'
  | 'createNew'
  | 'cancel'

interface DuplicateSongDialogProps {
  isOpen: boolean
  songTitle: string
  onAction: (action: DuplicateAction) => void
}

export function DuplicateSongDialog({
  isOpen,
  songTitle,
  onAction,
}: DuplicateSongDialogProps) {
  const { t } = useTranslation('songs')
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
      onAction('cancel')
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-lg shadow-xl backdrop:bg-black/50 bg-white dark:bg-gray-800"
      onClose={() => onAction('cancel')}
      onClick={handleBackdropClick}
    >
      <div className="p-6 min-w-[400px] max-w-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('duplicateDialog.title')}
          </h2>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {t('duplicateDialog.description', { title: songTitle })}
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => onAction('openExisting')}
            className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors text-left"
          >
            <div className="font-medium">
              {t('duplicateDialog.openExisting')}
            </div>
            <div className="text-sm text-indigo-200">
              {t('duplicateDialog.openExistingDescription')}
            </div>
          </button>
          <button
            type="button"
            onClick={() => onAction('overwrite')}
            className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors text-left"
          >
            <div className="font-medium">{t('duplicateDialog.overwrite')}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t('duplicateDialog.overwriteDescription')}
            </div>
          </button>
          <button
            type="button"
            onClick={() => onAction('createNew')}
            className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors text-left"
          >
            <div className="font-medium">{t('duplicateDialog.createNew')}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t('duplicateDialog.createNewDescription')}
            </div>
          </button>
          <button
            type="button"
            onClick={() => onAction('cancel')}
            className="w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {t('common:buttons.cancel', { ns: 'common' })}
          </button>
        </div>
      </div>
    </dialog>
  )
}
