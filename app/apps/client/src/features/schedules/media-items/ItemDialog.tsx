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
  /** The primary button's label and icon; Save by default. */
  saveLabel?: string
  saveIcon?: ReactNode
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
  saveLabel,
  saveIcon = <Save size={16} strokeWidth={1.5} />,
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
      className="fixed inset-0 m-auto w-full max-w-xl p-0 rounded-[10px] border border-line bg-panel shadow-popover backdrop:bg-black/50"
    >
      <div className="flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-line">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-base font-semibold text-fg">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label={t('actions.cancel')}
            className="p-1.5 rounded-lg text-fg-label hover:bg-hover hover:text-fg disabled:opacity-50"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">{children}</div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex items-center gap-2 h-9 px-4 text-sm font-medium bg-field text-fg hover:bg-hover rounded-lg disabled:opacity-50 transition-colors"
          >
            <X size={16} strokeWidth={1.5} />
            {t('actions.cancel')}
          </button>
          <button
            type="button"
            data-testid={`${testId}-save`}
            onClick={onSave}
            disabled={!canSave || isSaving}
            className="flex items-center gap-2 h-9 px-4 text-sm font-medium bg-primary text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? (
              <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
            ) : (
              saveIcon
            )}
            {saveLabel ?? t('insertSlide.save')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
