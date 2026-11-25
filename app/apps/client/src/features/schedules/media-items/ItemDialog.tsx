import { Loader2, Save, X } from 'lucide-react'
import { type ReactNode, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface ItemDialogProps {
  title: string
  icon: ReactNode
  testId: string
  /** Save is offered once the settings are complete. */
  canSave: boolean
  isSaving: boolean
  onSave: () => void
  onClose: () => void
  children: ReactNode
}

/** The dialog an item's settings are edited in: header, body, Cancel/Save. */
export function ItemDialog({
  title,
  icon,
  testId,
  canSave,
  isSaving,
  onSave,
  onClose,
  children,
}: ItemDialogProps) {
  const { t } = useTranslation('schedules')
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Mounted only while open: it opens as it mounts.
  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      data-testid={testId}
      onCancel={(e) => {
        e.preventDefault()
        if (!isSaving) onClose()
      }}
      className="fixed inset-0 m-auto w-full max-w-xl p-0 rounded-lg bg-white dark:bg-gray-800 backdrop:bg-black/50"
    >
      <div className="flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label={t('actions.cancel')}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">{children}</div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 text-white bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50 transition-colors"
          >
            <X size={16} />
            {t('actions.cancel')}
          </button>
          <button
            type="button"
            data-testid={`${testId}-save`}
            onClick={onSave}
            disabled={!canSave || isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {t('insertSlide.save')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
