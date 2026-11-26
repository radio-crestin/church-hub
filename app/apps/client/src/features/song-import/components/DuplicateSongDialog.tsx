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
      onAction('cancel')
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-xl shadow-popover backdrop:bg-black/50 bg-panel"
      onClose={() => onAction('cancel')}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="p-6 min-w-[400px] max-w-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 flex items-center justify-center pt-0.5">
            <AlertTriangle
              className="w-5 h-5 text-amber-600 dark:text-amber-400"
              strokeWidth={1.5}
            />
          </div>
          <h2 className="text-base font-semibold text-fg">
            {t('duplicateDialog.title')}
          </h2>
        </div>

        <p className="text-fg-label mb-6">
          {t('duplicateDialog.description', { title: songTitle })}
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => onAction('openExisting')}
            className="w-full px-4 py-3 bg-primary hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors text-left"
          >
            <div className="font-medium">
              {t('duplicateDialog.openExisting')}
            </div>
            <div className="text-sm text-white/75">
              {t('duplicateDialog.openExistingDescription')}
            </div>
          </button>
          <button
            type="button"
            onClick={() => onAction('overwrite')}
            className="w-full px-4 py-3 bg-field hover:bg-hover text-fg rounded-lg font-medium transition-colors text-left"
          >
            <div className="font-medium">{t('duplicateDialog.overwrite')}</div>
            <div className="text-sm text-fg-hint">
              {t('duplicateDialog.overwriteDescription')}
            </div>
          </button>
          <button
            type="button"
            onClick={() => onAction('createNew')}
            className="w-full px-4 py-3 bg-field hover:bg-hover text-fg rounded-lg font-medium transition-colors text-left"
          >
            <div className="font-medium">{t('duplicateDialog.createNew')}</div>
            <div className="text-sm text-fg-hint">
              {t('duplicateDialog.createNewDescription')}
            </div>
          </button>
          <button
            type="button"
            onClick={() => onAction('cancel')}
            className="w-full px-4 py-2 text-fg-label hover:text-fg transition-colors"
          >
            {t('common:buttons.cancel', { ns: 'common' })}
          </button>
        </div>
      </div>
    </dialog>
  )
}
