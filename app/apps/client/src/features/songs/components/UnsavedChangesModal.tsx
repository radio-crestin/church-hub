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
  const mouseDownTargetRef = useRef<EventTarget | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen])

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (
      e.target === dialogRef.current &&
      mouseDownTargetRef.current === dialogRef.current
    ) {
      onCancel()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-xl shadow-popover backdrop:bg-black/50 bg-panel"
      onClose={onCancel}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="p-6 min-w-[300px] max-w-md">
        <h2 className="text-base font-semibold text-fg mb-2">
          {t('songs:modal.unsavedChangesTitle')}
        </h2>
        <p className="text-fg-label mb-6">
          {t('songs:modal.unsavedChangesMessage')}
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-3.5 text-sm font-medium bg-field text-fg hover:bg-hover rounded-lg transition-colors"
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
